import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/server";
import { listAccounts } from "./accounts-tool.ts";
import { appendOperation } from "./oplog.ts";
import { annotationsFor, type Service, type Tool } from "./service.ts";

// src/core/ からも dist/core/ からも2つ上が package.json
const { version } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  version: string;
};

const MAX_ERROR_CHARS = 300;

/** read 以外のツールは、呼ばれるたびに成否を操作ログに残す */
export const withAudit = (tool: Tool): Tool["handler"] => {
  if (tool.risk === "read") return tool.handler;
  return async (args, ctx) => {
    const record = (ok: boolean, error?: string) =>
      appendOperation({ time: new Date().toISOString(), tool: tool.name, ...ctx.audit, ok, ...(error ? { error } : {}) })
        // ログが書けなくても、操作の結果は返す
        .catch((e) => console.error("操作ログを書けなかった:", e));
    try {
      const result = await tool.handler(args, ctx);
      const text = result.content?.[0]?.type === "text" ? result.content[0].text : "";
      await record(!result.isError, result.isError ? text.slice(0, MAX_ERROR_CHARS) : undefined);
      return result;
    } catch (e) {
      await record(false, String((e as Error).message).slice(0, MAX_ERROR_CHARS));
      throw e;
    }
  };
};

/** サービスのツールを集めて MCP サーバーを作る。通信の層には依存しない */
export const createServer = (services: Service[]): McpServer => {
  const server = new McpServer({ name: "multi-account-mcp", version });
  const tools = [listAccounts, ...services.flatMap((s) => s.tools)];
  for (const tool of tools) {
    const handler = withAudit(tool);
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: annotationsFor(tool.risk),
      },
      (args) => handler(args, { audit: {} }),
    );
  }
  return server;
};
