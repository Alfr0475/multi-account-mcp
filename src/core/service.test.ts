import assert from "node:assert/strict";
import { test } from "node:test";
import { annotationsFor } from "./service.ts";

test("annotationsFor: 危険度ごとに MCP のヒントを付ける", () => {
  assert.deepEqual(annotationsFor("read"), { readOnlyHint: true, destructiveHint: false, openWorldHint: true });
  assert.deepEqual(annotationsFor("write"), { readOnlyHint: false, destructiveHint: false, openWorldHint: true });
  assert.deepEqual(annotationsFor("destructive"), {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: true,
  });
});
