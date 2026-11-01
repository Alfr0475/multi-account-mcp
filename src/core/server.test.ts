import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { z } from "zod";
import { withAudit } from "./server.ts";
import { defineTool, type Risk } from "./service.ts";

let dir: string;
let log: string;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "multi-account-mcp-test-"));
});

beforeEach(() => {
  log = join(dir, `${Math.random()}.log`);
  process.env.MULTI_ACCOUNT_MCP_LOG_FILE = log;
});

after(async () => {
  await rm(dir, { recursive: true });
});

const readLog = async () =>
  (await readFile(log, "utf8").catch(() => ""))
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));

const tool = (risk: Risk, fail?: Error) =>
  defineTool({
    name: "t",
    title: "t",
    description: "t",
    risk,
    inputSchema: z.object({}),
    handler: async (_args, ctx) => {
      ctx.audit.account = "a@example.com";
      if (fail) throw fail;
      ctx.audit.fileId = "f1";
      return { content: [{ type: "text", text: "secret cell value" }] };
    },
  });

test("withAudit: 書くツールの成功を、対象だけ記録する（結果の中身は書かない）", async () => {
  await withAudit(tool("write"))({}, { audit: {} });
  const [entry] = await readLog();
  assert.equal(entry.tool, "t");
  assert.equal(entry.ok, true);
  assert.equal(entry.account, "a@example.com");
  assert.equal(entry.fileId, "f1");
  assert.ok(!JSON.stringify(entry).includes("secret"));
});

test("withAudit: 失敗したら、そこまでに分かった対象とエラーを記録して投げ直す", async () => {
  await assert.rejects(withAudit(tool("destructive", new Error("boom")))({}, { audit: {} }), /boom/);
  const [entry] = await readLog();
  assert.equal(entry.ok, false);
  assert.equal(entry.account, "a@example.com");
  assert.equal(entry.error, "boom");
});

test("withAudit: 読むツールは記録しない", async () => {
  await withAudit(tool("read"))({}, { audit: {} });
  assert.deepEqual(await readLog(), []);
});
