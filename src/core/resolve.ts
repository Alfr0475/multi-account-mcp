import { recordAccounts, recordedAccount } from "./file-index.ts";

export interface ResolveOptions<T> {
  service: string;
  fileId: string;
  /** 明示されたアカウント。あれば他は試さない */
  account?: string | undefined;
  /** 試す順に並べたアカウント（メールアドレス） */
  accounts: string[];
  /** アクセスできなかった（他のアカウントで試すべき）エラーか */
  isNoAccess: (error: unknown) => boolean;
  run: (email: string) => Promise<T>;
}

/**
 * ファイルにアクセスできるアカウントで run を実行する。
 * 記録があればそのアカウントから試し、なければ順に試す。成功したアカウントを記録する。
 */
export const withFileAccount = async <T>(o: ResolveOptions<T>): Promise<{ email: string; result: T }> => {
  if (o.account) {
    if (!o.accounts.includes(o.account)) {
      throw new Error(`${o.account} は繋がっていない。list_accounts で確かめる`);
    }
    const result = await o.run(o.account);
    await recordAccounts(o.service, [{ fileId: o.fileId, email: o.account }]);
    return { email: o.account, result };
  }

  if (o.accounts.length === 0) throw new Error("アカウントが1つも繋がっていない。multi-account-mcp login で足す");

  const recorded = await recordedAccount(o.service, o.fileId);
  const order =
    recorded && o.accounts.includes(recorded) ? [recorded, ...o.accounts.filter((a) => a !== recorded)] : o.accounts;

  for (const email of order) {
    try {
      const result = await o.run(email);
      if (email !== recorded) await recordAccounts(o.service, [{ fileId: o.fileId, email }]);
      return { email, result };
    } catch (e) {
      if (!o.isNoAccess(e)) throw e;
    }
  }
  throw new Error(`どのアカウントからも開けなかった: ${o.fileId}（${o.accounts.join(", ")} で試した）`);
};
