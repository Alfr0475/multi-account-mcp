import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { logFile } from "./paths.ts";

/** 操作の対象。ツールの中で分かった順に埋める。ファイルの中身、セルの値、トークンは入れない */
export interface Audit {
  account?: string;
  fileId?: string;
  fileName?: string;
  /** 元に戻すときの手がかり（変更前の名前、コピー元など） */
  note?: string;
}

export interface OperationEntry extends Audit {
  time: string;
  tool: string;
  ok: boolean;
  error?: string;
}

/** 書く・作る・削除の操作を1行（JSON）で残す。ローテーションはしない（docs/decisions.md の 16） */
export const appendOperation = async (entry: OperationEntry): Promise<void> => {
  const file = logFile();
  await mkdir(dirname(file), { recursive: true });
  await appendFile(file, JSON.stringify(entry) + "\n", { mode: 0o600 });
};
