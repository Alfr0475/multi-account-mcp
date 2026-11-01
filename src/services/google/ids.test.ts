import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFileRef } from "./ids.ts";

test("parseFileRef: ID はそのまま返す", () => {
  assert.deepEqual(parseFileRef(" 1AbC-d_E "), { id: "1AbC-d_E" });
});

test("parseFileRef: URL から ID とシートの gid を取り出す", () => {
  assert.deepEqual(parseFileRef("https://docs.google.com/spreadsheets/d/1AbC-d_E/edit#gid=123"), {
    id: "1AbC-d_E",
    gid: 123,
  });
  assert.deepEqual(parseFileRef("https://docs.google.com/spreadsheets/d/1AbC/edit?gid=0#gid=0"), { id: "1AbC", gid: 0 });
  assert.deepEqual(parseFileRef("https://docs.google.com/document/d/1AbC/edit"), { id: "1AbC" });
  assert.deepEqual(parseFileRef("https://drive.google.com/file/d/1AbC/view?usp=sharing"), { id: "1AbC" });
  assert.deepEqual(parseFileRef("https://drive.google.com/drive/folders/1AbC"), { id: "1AbC" });
  assert.deepEqual(parseFileRef("https://drive.google.com/open?id=1AbC"), { id: "1AbC" });
});

test("parseFileRef: ID の入っていない URL はエラー", () => {
  assert.throws(() => parseFileRef("https://drive.google.com/drive/my-drive"));
});
