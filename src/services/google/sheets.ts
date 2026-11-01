import { sheets } from "@googleapis/sheets";
import { z } from "zod";
import { defineTool } from "../../core/service.ts";
import { accountInput, fileInput, text, withGoogleFile } from "./common.ts";
import { parseFileRef } from "./ids.ts";

/** 範囲を指定しなかったときに返す最大の行数 */
const DEFAULT_MAX_ROWS = 200;

/** A1 表記でシート名を囲む（' は '' にする） */
export const quoteSheet = (title: string) => `'${title.replace(/'/g, "''")}'`;

export const sheetsRead = defineTool({
  name: "sheets_read",
  title: "スプレッドシートを読む",
  description: `スプレッドシートのセルの値（表示されている形式）を読む。シートの一覧も返す。range を省略すると、URL で開いていたシート（なければ最初のシート）の先頭 ${DEFAULT_MAX_ROWS} 行を返す。`,
  risk: "read",
  inputSchema: z.object({
    spreadsheet: fileInput,
    range: z.string().optional().describe("A1 表記の範囲。シート名を含めてよい（例: 'シート1'!A1:D20）"),
    account: accountInput,
  }),
  handler: async ({ spreadsheet, range, account }) => {
    const { id, gid } = parseFileRef(spreadsheet);
    const { email, result } = await withGoogleFile(id, account, async (auth) => {
      const s = sheets({ version: "v4", auth });
      const meta = await s.spreadsheets.get({
        spreadsheetId: id,
        fields: "properties.title,spreadsheetUrl,sheets.properties(sheetId,title,gridProperties(rowCount,columnCount))",
      });
      const sheetList = (meta.data.sheets ?? []).map((sh) => ({
        sheetId: sh.properties?.sheetId,
        title: sh.properties?.title ?? "",
        rows: sh.properties?.gridProperties?.rowCount,
        columns: sh.properties?.gridProperties?.columnCount,
      }));

      const opened = sheetList.find((sh) => sh.sheetId === gid) ?? sheetList[0];
      const target = range ?? (opened ? `${quoteSheet(opened.title)}!1:${DEFAULT_MAX_ROWS}` : undefined);
      const values = target
        ? await s.spreadsheets.values.get({ spreadsheetId: id, range: target, valueRenderOption: "FORMATTED_VALUE" })
        : undefined;

      return {
        title: meta.data.properties?.title,
        url: meta.data.spreadsheetUrl,
        sheets: sheetList,
        range: values?.data.range,
        values: values?.data.values ?? [],
        ...(range ? {} : { note: `範囲を指定しなかったので先頭 ${DEFAULT_MAX_ROWS} 行まで` }),
      };
    });
    return text({ account: email, ...result });
  },
});
