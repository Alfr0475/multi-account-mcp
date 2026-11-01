import { sheets } from "@googleapis/sheets";
import { z } from "zod";
import { defineTool } from "../../core/service.ts";
import { accountInput, fileInput, text, valuesInput, withGoogleFile } from "./common.ts";
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

export const sheetsWrite = defineTool({
  name: "sheets_write",
  title: "セルに書き込む",
  description:
    "スプレッドシートの指定した範囲のセルを書き換える。値は手で入力したのと同じように解釈される（数値・日付・数式）。書き換える前に sheets_read で中身と範囲を確かめること。",
  risk: "write",
  inputSchema: z.object({
    spreadsheet: fileInput,
    range: z.string().describe("A1 表記の書き込み先。左上のセルだけでもよい（例: 'シート1'!B3）"),
    values: valuesInput,
    account: accountInput,
  }),
  handler: async ({ spreadsheet, range, values, account }, ctx) => {
    const { id } = parseFileRef(spreadsheet);
    Object.assign(ctx.audit, { fileId: id, note: `range=${range}` });
    const { email, result } = await withGoogleFile(id, account, async (auth, email) => {
      ctx.audit.account = email;
      const s = sheets({ version: "v4", auth });
      const meta = await s.spreadsheets.get({ spreadsheetId: id, fields: "properties.title" });
      ctx.audit.fileName = meta.data.properties?.title ?? undefined;
      const res = await s.spreadsheets.values.update({
        spreadsheetId: id,
        range,
        valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
      return { title: ctx.audit.fileName, updatedRange: res.data.updatedRange, updatedCells: res.data.updatedCells };
    });
    ctx.audit.note = `range=${result.updatedRange}`;
    return text({ account: email, ...result });
  },
});

export const sheetsAppend = defineTool({
  name: "sheets_append",
  title: "行を末尾に追加",
  description:
    "スプレッドシートの表の末尾（最後に値がある行の次）に行を追加する。値は手で入力したのと同じように解釈される。range を省略すると、URL で開いていたシート（なければ最初のシート）に追加する。",
  risk: "write",
  inputSchema: z.object({
    spreadsheet: fileInput,
    range: z.string().optional().describe("追加先のシート名か表の範囲（例: 'シート1' や 'シート1'!A:D）"),
    values: valuesInput,
    account: accountInput,
  }),
  handler: async ({ spreadsheet, range, values, account }, ctx) => {
    const { id, gid } = parseFileRef(spreadsheet);
    ctx.audit.fileId = id;
    const { email, result } = await withGoogleFile(id, account, async (auth, email) => {
      ctx.audit.account = email;
      const s = sheets({ version: "v4", auth });
      const meta = await s.spreadsheets.get({
        spreadsheetId: id,
        fields: "properties.title,sheets.properties(sheetId,title)",
      });
      ctx.audit.fileName = meta.data.properties?.title ?? undefined;
      const sheetList = meta.data.sheets ?? [];
      const opened = sheetList.find((sh) => sh.properties?.sheetId === gid) ?? sheetList[0];
      const target = range ?? quoteSheet(opened?.properties?.title ?? "");
      ctx.audit.note = `range=${target}`;
      const res = await s.spreadsheets.values.append({
        spreadsheetId: id,
        range: target,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values },
      });
      return {
        title: ctx.audit.fileName,
        updatedRange: res.data.updates?.updatedRange,
        updatedRows: res.data.updates?.updatedRows,
      };
    });
    ctx.audit.note = `range=${result.updatedRange}`;
    return text({ account: email, ...result });
  },
});
