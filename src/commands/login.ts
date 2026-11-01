import { loadConfig, saveConfig } from "../core/config.ts";
import { OnePasswordStore } from "../core/secrets.ts";
import type { Service } from "../core/service.ts";

export const login = async (service: Service): Promise<void> => {
  const config = await loadConfig();
  const store = new OnePasswordStore(config.onePassword.account, config.onePassword.vault);

  const { email, fields } = await service.login(store);
  const item = await store.create(`${service.name} ${email}`, fields);

  const old = config.accounts.find((a) => a.service === service.name && a.email === email);
  config.accounts = [...config.accounts.filter((a) => a !== old), { service: service.name, email, item }];
  await saveConfig(config);

  // ログインし直したときは古い項目を消す。古いトークンは Google 側では取り消さない
  // （取り消すとこのアプリへの許可ごと消え、いま受け取ったトークンも使えなくなる）
  if (old) await store.remove(old.item);

  console.error(`ログインしました: ${service.name} ${email}`);
};
