import { execFile } from "node:child_process";
import { access, constants, readFile, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

const NAME = "multi-account-mcp";

export interface ServerEntry {
  command: string;
  args: string[];
  env: Record<string, string>;
}

const desktopConfigFile = (): string =>
  process.env.MULTI_ACCOUNT_MCP_DESKTOP_CONFIG ??
  join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");

const exists = (path: string, mode = constants.F_OK): Promise<boolean> =>
  access(path, mode).then(
    () => true,
    () => false,
  );

const findInPath = async (command: string): Promise<string | undefined> => {
  for (const dir of (process.env.PATH ?? "").split(":")) {
    const path = join(dir, command);
    if (dir && (await exists(path, constants.X_OK))) return path;
  }
  return undefined;
};

/**
 * Claude Desktop はシェルの設定を読まずに起動するので、Node と op は絶対パスで登録する。
 * Node は register を動かしている Node（mise.toml で固定したもの）をそのまま使う。
 */
const serverEntry = async (): Promise<ServerEntry> => {
  // src/commands/ からも dist/commands/ からも2つ上がリポジトリ
  const cli = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));
  if (!(await exists(cli))) throw new Error(`${cli} がない。先に npm run build する`);
  const op = await findInPath("op");
  if (!op) throw new Error("op が PATH にない。mise exec -- で動かす");
  return { command: process.execPath, args: [cli, "serve"], env: { MULTI_ACCOUNT_MCP_OP: op } };
};

/** Claude Desktop の設定に、このサーバーを足す（entry を渡さなければ外す）。ほかの設定には触らない */
export const withServer = (config: Record<string, unknown>, entry?: ServerEntry): Record<string, unknown> => {
  const servers = { ...((config.mcpServers as Record<string, unknown> | undefined) ?? {}) };
  if (entry) servers[NAME] = entry;
  else delete servers[NAME];
  const { mcpServers: _, ...rest } = config;
  return Object.keys(servers).length > 0 ? { ...rest, mcpServers: servers } : rest;
};

const updateDesktop = async (entry?: ServerEntry): Promise<void> => {
  const file = desktopConfigFile();
  if (!(await exists(dirname(file)))) {
    console.error("Claude Desktop: 見つからないので飛ばした");
    return;
  }
  const text = await readFile(file, "utf8").catch(() => "{}");
  const mode = await stat(file).then(
    (s) => s.mode & 0o777,
    () => 0o600,
  );
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(withServer(JSON.parse(text), entry), null, 2) + "\n", { mode });
  await rename(tmp, file);
  console.error(`Claude Desktop: ${entry ? "登録した" : "外した"}（再起動すると反映される）`);
};

const updateClaudeCode = async (entry?: ServerEntry): Promise<void> => {
  const claude = await findInPath("claude");
  if (!claude) {
    console.error("Claude Code: claude が PATH にないので飛ばした");
    return;
  }
  // 登録し直すときに古いパスが残らないよう、先に外す（未登録なら失敗するが構わない）
  await run(claude, ["mcp", "remove", "--scope", "user", NAME]).catch(() => undefined);
  if (entry) {
    const env = Object.entries(entry.env).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
    await run(claude, ["mcp", "add", "--scope", "user", NAME, ...env, "--", entry.command, ...entry.args]);
  }
  console.error(`Claude Code: ${entry ? "ユーザースコープに登録した" : "外した"}`);
};

export const register = async (): Promise<void> => {
  const entry = await serverEntry();
  console.error(`node: ${entry.command}\nop:   ${entry.env.MULTI_ACCOUNT_MCP_OP}\ncli:  ${entry.args[0]}\n`);
  await updateClaudeCode(entry);
  await updateDesktop(entry);
};

export const unregister = async (): Promise<void> => {
  await updateClaudeCode();
  await updateDesktop();
};
