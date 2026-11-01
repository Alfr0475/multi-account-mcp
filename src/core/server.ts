import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/server";
import { annotationsFor, type Service } from "./service.ts";

// src/core/ からも dist/core/ からも2つ上が package.json
const { version } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  version: string;
};

/** サービスのツールを集めて MCP サーバーを作る。通信の層には依存しない */
export const createServer = (services: Service[]): McpServer => {
  const server = new McpServer({ name: "multi-account-mcp", version });
  for (const service of services) {
    for (const tool of service.tools) {
      server.registerTool(
        tool.name,
        {
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: annotationsFor(tool.risk),
        },
        (args) => tool.handler(args),
      );
    }
  }
  return server;
};
