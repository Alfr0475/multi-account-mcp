import { homedir } from "node:os";
import { join } from "node:path";

// テストや開発中は環境変数で一時ディレクトリに向け、本番の設定とログを汚さない

/** アカウント一覧と「ファイル→アカウント」の記録を置く。秘密情報は置かない */
export const configDir = (): string =>
  process.env.MULTI_ACCOUNT_MCP_CONFIG_DIR ?? join(homedir(), ".config", "multi-account-mcp");

/** 書く・作る・削除の操作の記録 */
export const logFile = (): string =>
  process.env.MULTI_ACCOUNT_MCP_LOG_FILE ?? join(homedir(), "Library", "Logs", "multi-account-mcp.log");
