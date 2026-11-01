import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { test } from "node:test";

const cli = new URL("./cli.ts", import.meta.url).pathname;

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
