import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/server";
import type { z } from "zod";

/**
 * ツールの危険度。Claude Code の permissions で段ごとに許可を分けられるよう、ツール名ではなくここで分ける。
 * - read: 読むだけ
 * - write: 書く・作る（戻せる）
 * - destructive: 削除など（ゴミ箱への移動も含む）
 */
export type Risk = "read" | "write" | "destructive";

export interface Tool<S extends z.ZodObject = z.ZodObject> {
  name: string;
  title: string;
  description: string;
  risk: Risk;
  inputSchema: S;
  handler: (args: z.infer<S>) => Promise<CallToolResult>;
}

/** サービス層の1つ（google など）。共通の層はこれを集めて MCP サーバーに登録する */
export interface Service {
  name: string;
  tools: Tool[];
}

/** 引数の型を推論させるための入口。`Tool[]` に入れると推論が消えるので、定義はこれを通す */
export const defineTool = <S extends z.ZodObject>(tool: Tool<S>): Tool => tool as unknown as Tool;

export const annotationsFor = (risk: Risk): ToolAnnotations => ({
  readOnlyHint: risk === "read",
  destructiveHint: risk === "destructive",
  // どのツールも外部のサービス（Google など）を相手にする
  openWorldHint: true,
});
