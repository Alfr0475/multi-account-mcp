import type { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { withFileAccount } from "../../core/resolve.ts";
import { authFor, googleAccounts, isNoAccess } from "./clients.ts";

export const accountInput = z
  .string()
  .optional()
  .describe("使うアカウントのメールアドレス。普段は省略する（アクセスできるアカウントを自動で選ぶ）");

export const fileInput = z.string().describe("ファイル ID か、Google ドキュメント・スプレッドシート・Drive の URL");

export const text = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });

/** ファイルにアクセスできる Google アカウントで run を実行する */
export const withGoogleFile = async <T>(
  fileId: string,
  account: string | undefined,
  run: (auth: OAuth2Client) => Promise<T>,
): Promise<{ email: string; result: T }> => {
  const accounts = await googleAccounts();
  return withFileAccount({
    service: "google",
    fileId,
    account,
    accounts: accounts.map((a) => a.email),
    isNoAccess,
    run: async (email) => run(await authFor(accounts.find((a) => a.email === email)!)),
  });
};
