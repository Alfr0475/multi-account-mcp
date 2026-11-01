import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import type { Account } from "../../core/config.ts";
import type { LoginResult } from "../../core/service.ts";
import type { SecretStore } from "../../core/secrets.ts";

/** OAuth クライアントの ID とシークレットを入れた 1Password の項目（docs/setup-google.md） */
const CLIENT_ITEM = "google-oauth-client";

const DRIVE = "https://www.googleapis.com/auth/drive";
const SHEETS = "https://www.googleapis.com/auth/spreadsheets";
/** openid と email は、ログインしたアカウントのメールアドレスを知るため */
const SCOPES = ["openid", "email", DRIVE, SHEETS];

const LOGIN_TIMEOUT_MS = 5 * 60_000;

/** 同意画面ではスコープごとにチェックを外せるので、足りないものを返す */
export const missingScopes = (granted: string | undefined): string[] => {
  const got = new Set((granted ?? "").split(" "));
  return [DRIVE, SHEETS].filter((s) => !got.has(s));
};

export interface ClientCredentials {
  clientId: string;
  clientSecret: string;
}

export const readClientCredentials = async (store: SecretStore): Promise<ClientCredentials> => ({
  clientId: await store.read(CLIENT_ITEM, "client_id"),
  clientSecret: await store.read(CLIENT_ITEM, "client_secret"),
});

/** 127.0.0.1 の空いているポートで、ブラウザからのリダイレクトを1回だけ受ける */
const waitForCode = (server: Server, state: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("5分以内にログインが終わらなかった")), LOGIN_TIMEOUT_MS);
    server.on("request", (req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code");
      if (!error && !code) {
        // favicon などは無視する
        res.writeHead(404).end();
        return;
      }
      const ok = !error && url.searchParams.get("state") === state;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(ok ? "ログインできました。このタブを閉じてください。" : "ログインできませんでした。ターミナルを見てください。");
      clearTimeout(timer);
      if (error) reject(new Error(`Google がログインを断った: ${error}`));
      else if (!ok) reject(new Error("state が一致しない（別のリクエストが紛れ込んだ可能性がある）"));
      else resolve(code!);
    });
  });

export const login = async (store: SecretStore): Promise<LoginResult> => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address() as AddressInfo;
    const redirectUri = `http://127.0.0.1:${port}`;
    const credentials = await readClientCredentials(store);
    const client = new OAuth2Client({ ...credentials, redirectUri });

    const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
    const state = randomBytes(16).toString("hex");
    const authUrl = client.generateAuthUrl({
      access_type: "offline",
      // 2回目以降のログインでもリフレッシュトークンを必ず受け取るため
      prompt: "consent",
      scope: SCOPES,
      code_challenge_method: CodeChallengeMethod.S256,
      code_challenge: codeChallenge,
      state,
    });

    console.error(`ブラウザで Google のログイン画面を開きます。開かなければ次の URL を開いてください。\n${authUrl}\n`);
    execFile("open", [authUrl]);

    const code = await waitForCode(server, state);
    const { tokens } = await client.getToken({ code, codeVerifier, redirect_uri: redirectUri });

    const missing = missingScopes(tokens.scope ?? undefined);
    if (missing.length > 0) {
      throw new Error(`同意画面で許可されなかった権限がある: ${missing.join(", ")}。すべてにチェックを入れてやり直してください`);
    }
    if (!tokens.refresh_token) throw new Error("リフレッシュトークンを受け取れなかった");
    if (!tokens.id_token) throw new Error("ID トークンを受け取れなかった");

    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: credentials.clientId });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) throw new Error("メールアドレスを確かめられなかった");

    return {
      email: payload.email,
      fields: [
        { label: "email", value: payload.email, concealed: false },
        { label: "refresh_token", value: tokens.refresh_token, concealed: true },
      ],
    };
  } finally {
    server.close();
  }
};

/** リフレッシュトークンを取り消す。このアプリへの許可ごと消え、同じ許可から出たアクセストークンも使えなくなる */
export const logout = async (store: SecretStore, account: Account): Promise<void> => {
  const refreshToken = await store.read(account.item, "refresh_token");
  try {
    await new OAuth2Client().revokeToken(refreshToken);
  } catch (e) {
    // すでに取り消されている（Google アカウントの画面から外した、など）なら先に進む
    const data = (e as { response?: { data?: { error?: string } } }).response?.data;
    if (data?.error !== "invalid_token") throw e;
    console.error("トークンはすでに無効だった");
  }
};
