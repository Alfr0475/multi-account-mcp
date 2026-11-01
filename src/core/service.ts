import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/server";
import type { z } from "zod";
import type { Account } from "./config.ts";
import type { Audit } from "./oplog.ts";
import type { SecretField, SecretStore } from "./secrets.ts";

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
  handler: (args: z.infer<S>, ctx: ToolContext) => Promise<CallToolResult>;
}

export interface ToolContext {
  /** 操作ログに残す対象。read 以外のツールは、分かったところから埋める（失敗してもそこまでが残る） */
  audit: Audit;
}

export interface LoginResult {
  email: string;
  /** 1Password の項目に保存するもの */
  fields: SecretField[];
}

/** サービス層の1つ（google など）。共通の層はこれを集めて MCP サーバーに登録する */
export interface Service {
  name: string;
  tools: Tool[];
  /** ブラウザでログインする。保存は呼び出し側が行う */
  login: (store: SecretStore) => Promise<LoginResult>;
  /** サービス側でトークンを取り消す。1Password と設定からの削除は呼び出し側が行う */
  logout: (store: SecretStore, account: Account) => Promise<void>;
}

/** 引数の型を推論させるための入口。`Tool[]` に入れると推論が消えるので、定義はこれを通す */
export const defineTool = <S extends z.ZodObject>(tool: Tool<S>): Tool => tool as unknown as Tool;

export const annotationsFor = (risk: Risk): ToolAnnotations => ({
  readOnlyHint: risk === "read",
  destructiveHint: risk === "destructive",
  // どのツールも外部のサービス（Google など）を相手にする
  openWorldHint: true,
});
