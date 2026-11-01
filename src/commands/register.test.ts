import assert from "node:assert/strict";
import { test } from "node:test";
import { withServer } from "./register.ts";

const entry = { command: "/node", args: ["/cli.js", "serve"], env: { MULTI_ACCOUNT_MCP_OP: "/op" } };

test("withServer: ほかの設定とほかのサーバーを残したまま足し、外す", () => {
  const config = { preferences: { sidebarMode: "chat" }, mcpServers: { other: { command: "x" } } };

  const added = withServer(config, entry);
  assert.deepEqual(added, {
    preferences: { sidebarMode: "chat" },
    mcpServers: { other: { command: "x" }, "multi-account-mcp": entry },
  });

  assert.deepEqual(withServer(added), config);
});

test("withServer: ほかにサーバーがなければ mcpServers ごと外す", () => {
  const config = { preferences: {} };
  assert.deepEqual(withServer(withServer(config, entry)), config);
});
