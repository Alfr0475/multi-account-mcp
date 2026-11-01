import { loadConfig, saveConfig } from "../core/config.ts";
import { forgetAccount } from "../core/file-index.ts";
import { OnePasswordStore } from "../core/secrets.ts";
import type { Service } from "../core/service.ts";

export const logout = async (service: Service, email: string | undefined): Promise<void> => {
  const config = await loadConfig();
  const accounts = config.accounts.filter((a) => a.service === service.name);
  const account = accounts.find((a) => a.email === email);
  if (!account) {
    const list = accounts.map((a) => a.email).join(", ") || "なし";
    throw new Error(`外すアカウントのメールアドレスを指定する（${service.name} のアカウント: ${list}）`);
  }
  const store = new OnePasswordStore(config.onePassword.account, config.onePassword.vault);

  // 先にサービス側で取り消す。失敗したら何も消さない（1Password にトークンが残っていれば、やり直せる）
  await service.logout(store, account);
  await store.remove(account.item);
  config.accounts = config.accounts.filter((a) => a !== account);
  await saveConfig(config);
  await forgetAccount(service.name, account.email);

  console.error(`ログアウトしました: ${service.name} ${account.email}`);
};
