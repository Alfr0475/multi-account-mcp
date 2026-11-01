import { drive, type drive_v3 } from "@googleapis/drive";
import { z } from "zod";
import { recordAccounts } from "../../core/file-index.ts";
import { defineTool } from "../../core/service.ts";
import { authFor, googleAccounts } from "./clients.ts";
import { accountInput, fileInput, text, withGoogleFile } from "./common.ts";
import { parseFileRef } from "./ids.ts";

const MAX_CHARS = 100_000;
const MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024;

const FOLDER = "application/vnd.google-apps.folder";
/** Google 形式のファイルを読むときの書き出し形式 */
const EXPORT_AS: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

const isTextLike = (mimeType: string) =>
  mimeType.startsWith("text/") || /^application\/(json|xml|javascript|x-yaml|yaml|csv)/.test(mimeType);

const truncate = (body: string) =>
  body.length > MAX_CHARS
    ? { body: body.slice(0, MAX_CHARS), note: `長いので先頭の ${MAX_CHARS} 文字だけを返した（全体は ${body.length} 文字）` }
    : { body };

/** Drive の検索式の文字列リテラルに入れられるようにする */
export const escapeQuery = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export const driveSearch = defineTool({
  name: "drive_search",
  title: "Drive を検索",
  description:
    "繋がっているすべての Google アカウントの Drive を横断して、ファイル名と本文から検索する。結果にはどのアカウントのファイルかが付く。ゴミ箱のファイルは含まない。",
  risk: "read",
  inputSchema: z.object({
    query: z.string().min(1).describe("探す言葉"),
    account: accountInput,
    limit: z.number().int().min(1).max(50).default(20).describe("アカウントごとの最大件数"),
  }),
  handler: async ({ query, account, limit }) => {
    const all = await googleAccounts();
    const targets = account ? all.filter((a) => a.email === account) : all;
    if (targets.length === 0) throw new Error(account ? `${account} は繋がっていない` : "アカウントが1つも繋がっていない");

    const q = `(name contains '${escapeQuery(query)}' or fullText contains '${escapeQuery(query)}') and trashed = false`;
    const results = [];
    const errors = [];
    for (const target of targets) {
      try {
        const res = await drive({ version: "v3", auth: await authFor(target) }).files.list({
          q,
          pageSize: limit,
          corpora: "allDrives",
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
          orderBy: "modifiedTime desc",
          fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
        });
        const files = res.data.files ?? [];
        // 検索で見つかったファイルは、そのアカウントのものとして覚えておく
        await recordAccounts(
          "google",
          files.map((f) => ({ fileId: f.id!, email: target.email })),
        );
        results.push(...files.map((f) => ({ account: target.email, ...f })));
      } catch (e) {
        // 片方のアカウントが失敗しても、もう片方の結果は返す
        errors.push({ account: target.email, error: (e as Error).message });
      }
    }
    return text(errors.length > 0 ? { files: results, errors } : { files: results });
  },
});

const readContent = async (d: drive_v3.Drive, file: drive_v3.Schema$File): Promise<string | undefined> => {
  const mimeType = file.mimeType ?? "";
  const exportAs = EXPORT_AS[mimeType];
  if (exportAs) {
    const res = await d.files.export({ fileId: file.id!, mimeType: exportAs }, { responseType: "text" });
    return res.data as string;
  }
  if (isTextLike(mimeType) && Number(file.size ?? 0) <= MAX_DOWNLOAD_BYTES) {
    const res = await d.files.get(
      { fileId: file.id!, alt: "media", supportsAllDrives: true },
      { responseType: "text" },
    );
    return res.data as unknown as string;
  }
  return undefined;
};

export const driveRead = defineTool({
  name: "drive_read",
  title: "ファイルを読む",
  description:
    "Drive のファイルの中身をテキストで読む。Google ドキュメント・スライドはテキスト、スプレッドシートは最初のシートを CSV にして返す（シートを選んだり範囲を絞ったりするなら sheets_read）。テキスト形式のファイルはそのまま返す。フォルダなら中のファイルの一覧を返す。",
  risk: "read",
  inputSchema: z.object({ file: fileInput, account: accountInput }),
  handler: async ({ file, account }) => {
    const { id } = parseFileRef(file);
    const { email, result } = await withGoogleFile(id, account, async (auth) => {
      const d = drive({ version: "v3", auth });
      const meta = await d.files.get({
        fileId: id,
        supportsAllDrives: true,
        fields: "id,name,mimeType,size,modifiedTime,webViewLink",
      });
      if (meta.data.mimeType === FOLDER) {
        const children = await d.files.list({
          q: `'${escapeQuery(id)}' in parents and trashed = false`,
          pageSize: 100,
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
          fields: "files(id,name,mimeType,modifiedTime)",
        });
        return { meta: meta.data, children: children.data.files ?? [] };
      }
      return { meta: meta.data, content: await readContent(d, meta.data) };
    });

    if ("children" in result) return text({ account: email, ...result.meta, children: result.children });
    if (result.content === undefined) {
      return text({ account: email, ...result.meta, note: "この形式のファイルは中身をテキストで読めない" });
    }
    const { body, note } = truncate(result.content);
    const header = JSON.stringify({ account: email, ...result.meta, ...(note ? { note } : {}) }, null, 2);
    return { content: [{ type: "text", text: `${header}\n\n${body}` }] };
  },
});
