import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { recordedAccount } from "./file-index.ts";
import { withFileAccount } from "./resolve.ts";

let dir: string;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "multi-account-mcp-test-"));
  process.env.MULTI_ACCOUNT_MCP_CONFIG_DIR = join(dir, "config");
});

after(async () => {
  await rm(dir, { recursive: true });
});

const noAccess = new Error("not found");

/** owner のアカウントでだけ開けるファイル。試した順を tried に残す */
const fileOwnedBy = (owner: string, tried: string[]) => async (email: string) => {
  tried.push(email);
  if (email !== owner) throw noAccess;
  return `read by ${email}`;
};

const options = (fileId: string, run: (email: string) => Promise<string>, account?: string) => ({
  service: "google",
  fileId,
  account,
  accounts: ["personal@example.com", "work@example.com"],
  isNoAccess: (e: unknown) => e === noAccess,
  run,
});

test("withFileAccount: 開けるアカウントを順に探し、見つかったら覚える", async () => {
  const tried: string[] = [];
  const res = await withFileAccount(options("f1", fileOwnedBy("work@example.com", tried)));
  assert.equal(res.email, "work@example.com");
  assert.deepEqual(tried, ["personal@example.com", "work@example.com"]);
  assert.equal(await recordedAccount("google", "f1"), "work@example.com");

  // 2回目は覚えたアカウントから試す
  const again: string[] = [];
  await withFileAccount(options("f1", fileOwnedBy("work@example.com", again)));
  assert.deepEqual(again, ["work@example.com"]);
});

test("withFileAccount: 覚えたアカウントで開けなくなったら、他を試して覚え直す", async () => {
  await withFileAccount(options("f2", fileOwnedBy("work@example.com", [])));
  const tried: string[] = [];
  const res = await withFileAccount(options("f2", fileOwnedBy("personal@example.com", tried)));
  assert.equal(res.email, "personal@example.com");
  assert.deepEqual(tried, ["work@example.com", "personal@example.com"]);
  assert.equal(await recordedAccount("google", "f2"), "personal@example.com");
});

test("withFileAccount: どれでも開けなければエラー、アクセス以外のエラーはそのまま投げる", async () => {
  await assert.rejects(withFileAccount(options("f3", fileOwnedBy("nobody@example.com", []))), /どのアカウントからも/);
  const boom = new Error("boom");
  await assert.rejects(
    withFileAccount(
      options("f4", async () => {
        throw boom;
      }),
    ),
    boom,
  );
});

test("withFileAccount: アカウントを明示したらそれだけを使い、知らないアカウントはエラー", async () => {
  const tried: string[] = [];
  await assert.rejects(
    withFileAccount(options("f5", fileOwnedBy("work@example.com", tried), "personal@example.com")),
    noAccess,
  );
  assert.deepEqual(tried, ["personal@example.com"]);
  await assert.rejects(
    withFileAccount(options("f5", fileOwnedBy("work@example.com", []), "other@example.com")),
    /繋がっていない/,
  );
});

test("forgetAccount: 外したアカウントの記録だけを消す", async () => {
  const { forgetAccount, recordAccounts } = await import("./file-index.ts");
  await recordAccounts("google", [
    { fileId: "g1", email: "personal@example.com" },
    { fileId: "g2", email: "work@example.com" },
  ]);
  await forgetAccount("google", "personal@example.com");
  assert.equal(await recordedAccount("google", "g1"), undefined);
  assert.equal(await recordedAccount("google", "g2"), "work@example.com");
});
