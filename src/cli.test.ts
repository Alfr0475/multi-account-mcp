import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { saveConfig } from "./core/config.ts";

const cli = new URL("./cli.ts", import.meta.url).pathname;

let dir: string;

before(async () => {
  // 本番の設定を読まないよう、一時ディレクトリに向ける（serve の子プロセスにも引き継がれる）
  dir = await mkdtemp(join(tmpdir(), "multi-account-mcp-test-"));
  process.env.MULTI_ACCOUNT_MCP_CONFIG_DIR = join(dir, "config");
  await saveConfig({
    onePassword: { account: "my.1password.com", vault: "Multi-Account MCP" },
    accounts: [{ service: "google", email: "a@example.com", item: "abc123" }],
  });
});

after(async () => {
  await rm(dir, { recursive: true });
});

/** serve を起動し、JSON-RPC のリクエストを順に送って、応答を id ごとに返す */
const talk = async (requests: object[]): Promise<Map<number, any>> => {
  const child = spawn(process.execPath, [cli, "serve"], { stdio: ["pipe", "pipe", "inherit"] });
  const responses = new Map<number, any>();
  const lines = createInterface({ input: child.stdout });
  const expected = requests.filter((r) => "id" in r).length;
  const done = new Promise<void>((resolve, reject) => {
    lines.on("line", (line) => {
      const msg = JSON.parse(line);
      responses.set(msg.id, msg);
      if (responses.size === expected) resolve();
    });
    child.on("exit", (code) => reject(new Error(`serve が終了した: ${code}`)));
  });
  for (const r of requests) child.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...r }) + "\n");
  await done;
  child.kill();
  return responses;
};

test("serve: 初期化に応答する", async () => {
  const res = await talk([
    {
      id: 1,
      method: "initialize",
      params: {
        // Claude Code・Claude Desktop が使う古めの版でも話せること
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      },
    },
  ]);

  const init = res.get(1);
  assert.equal(init.result.protocolVersion, "2025-06-18");
  assert.equal(init.result.serverInfo.name, "multi-account-mcp");
});

test("serve: list_accounts を読むツールとして出し、アカウント一覧を返す", async () => {
  const res = await talk([
    {
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } },
    },
    { method: "notifications/initialized" },
    { id: 2, method: "tools/list" },
    { id: 3, method: "tools/call", params: { name: "list_accounts", arguments: {} } },
  ]);

  const tool = res.get(2).result.tools.find((t: { name: string }) => t.name === "list_accounts");
  assert.equal(tool.annotations.readOnlyHint, true);

  // 1Password の項目 ID は Claude に見せない
  const accounts = JSON.parse(res.get(3).result.content[0].text);
  assert.deepEqual(accounts, [{ service: "google", email: "a@example.com" }]);
});
