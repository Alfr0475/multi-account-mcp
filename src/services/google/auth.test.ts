import assert from "node:assert/strict";
import { test } from "node:test";
import { missingScopes } from "./auth.ts";

test("missingScopes: 同意画面で外された権限を返す", () => {
  const drive = "https://www.googleapis.com/auth/drive";
  const sheets = "https://www.googleapis.com/auth/spreadsheets";
  assert.deepEqual(missingScopes(`openid ${drive} ${sheets} email`), []);
  assert.deepEqual(missingScopes(`openid ${drive}`), [sheets]);
  assert.deepEqual(missingScopes(undefined), [drive, sheets]);
});
