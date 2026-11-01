import assert from "node:assert/strict";
import { test } from "node:test";
import { escapeQuery } from "./drive.ts";
import { quoteSheet } from "./sheets.ts";

test("escapeQuery: Drive の検索式で ' と \\ を逃がす", () => {
  assert.equal(escapeQuery(`it's a\\b`), `it\\'s a\\\\b`);
});

test("quoteSheet: シート名を ' で囲み、中の ' は重ねる", () => {
  assert.equal(quoteSheet("作業報告"), "'作業報告'");
  assert.equal(quoteSheet("Bob's"), "'Bob''s'");
});
