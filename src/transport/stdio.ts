import type { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";

/** 標準出力は MCP の通信に使うので、ここから先で console.log を使ってはいけない。デバッグ出力は標準エラー出力へ */
export const serveStdio = async (server: McpServer): Promise<void> => {
  await server.connect(new StdioServerTransport());
};
