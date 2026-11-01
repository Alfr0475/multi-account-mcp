import { OAuth2Client } from "google-auth-library";
import { loadConfig, type Account } from "../../core/config.ts";
import { OnePasswordStore } from "../../core/secrets.ts";
import { readClientCredentials, type ClientCredentials } from "./auth.ts";

// 1Password は最初に1回だけ読み、あとはメモリに持つ（docs/decisions.md の 13）。
// アクセストークンは OAuth2Client がメモリの中だけで更新する

let credentials: Promise<ClientCredentials> | undefined;
const clients = new Map<string, Promise<OAuth2Client>>();

// 検索などで複数のアカウントを同時に読むとき、Touch ID の承認が重ならないよう op は1つずつ呼ぶ
let opQueue: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = opQueue.then(fn);
  opQueue = next.catch(() => undefined);
  return next;
};

export const googleAccounts = async (): Promise<Account[]> =>
  (await loadConfig()).accounts.filter((a) => a.service === "google");

const createAuth = async (account: Account): Promise<OAuth2Client> => {
  const config = await loadConfig();
  const store = new OnePasswordStore(config.onePassword.account, config.onePassword.vault);
  credentials ??= serial(() => readClientCredentials(store));
  const client = new OAuth2Client(await credentials);
  const refreshToken = await serial(() => store.read(account.item, "refresh_token"));
  client.setCredentials({ refresh_token: refreshToken });
  return client;
};

export const authFor = (account: Account): Promise<OAuth2Client> => {
  let client = clients.get(account.email);
  if (!client) {
    client = createAuth(account);
    // 失敗（Touch ID を断ったなど）は覚えず、次の呼び出しでやり直す
    client.catch(() => clients.delete(account.email));
    clients.set(account.email, client);
  }
  return client;
};

const status = (e: unknown): number | undefined => {
  const err = e as { status?: number; response?: { status?: number } };
  return err.status ?? err.response?.status;
};

/** このアカウントからは見えない（他のアカウントで試すべき）エラーか */
export const isNoAccess = (e: unknown): boolean => {
  const code = status(e);
  // 403 には回数制限も含まれるので、それは除く
  return code === 404 || (code === 403 && !/rate ?limit|quota/i.test(String((e as Error).message)));
};
