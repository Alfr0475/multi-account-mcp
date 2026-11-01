import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { configDir } from "./paths.ts";

/** 繋いでいるアカウント。サービスとメールアドレスの組で見分ける */
export interface Account {
  service: string;
  email: string;
  /** 1Password の項目の ID。`op://` の参照では `@` が使えないので、題名ではなく ID で読む */
  item: string;
}

/** 秘密情報は書かない */
export interface Config {
  onePassword: { account: string; vault: string };
  accounts: Account[];
}

const defaults = (): Config => ({
  onePassword: { account: "my.1password.com", vault: "Multi-Account MCP" },
  accounts: [],
});

const configFile = () => join(configDir(), "config.json");

export const loadConfig = async (): Promise<Config> => {
  let text: string;
  try {
    text = await readFile(configFile(), "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return defaults();
    throw e;
  }
  return { ...defaults(), ...(JSON.parse(text) as Partial<Config>) };
};

export const saveConfig = async (config: Config): Promise<void> => {
  await mkdir(configDir(), { recursive: true, mode: 0o700 });
  // 書きかけで壊れないよう、別のファイルに書いてから置き換える
  const tmp = `${configFile()}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  await rename(tmp, configFile());
};
