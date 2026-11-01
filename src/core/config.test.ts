import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { loadConfig, saveConfig } from "./config.ts";

let dir: string;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "multi-account-mcp-test-"));
  process.env.MULTI_ACCOUNT_MCP_CONFIG_DIR = join(dir, "config");
});

after(async () => {
  await rm(dir, { recursive: true });
});

test("loadConfig: ファイルがなければ既定値を返す", async () => {
  const config = await loadConfig();
  assert.deepEqual(config.accounts, []);
  assert.equal(config.onePassword.vault, "Multi-Account MCP");
});

test("saveConfig: 保存したものを読み戻せ、本人だけが読める", async () => {
  const config = await loadConfig();
  config.accounts.push({ service: "google", email: "a@example.com", item: "abc123" });
  await saveConfig(config);

  assert.deepEqual((await loadConfig()).accounts, config.accounts);
  const file = join(process.env.MULTI_ACCOUNT_MCP_CONFIG_DIR!, "config.json");
  assert.equal((await stat(file)).mode & 0o777, 0o600);
});
