import { drive } from "@googleapis/drive";
import type { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { recordAccounts } from "../../core/file-index.ts";
import { defineTool } from "../../core/service.ts";
import { googleAccounts } from "./clients.ts";
import { accountInput, authForEmail, fileInput, text, withGoogleFile } from "./common.ts";
import { parseFileRef } from "./ids.ts";

const FOLDER = "application/vnd.google-apps.folder";
const FILE_FIELDS = "id,name,mimeType,webViewLink";

const KINDS = {
  folder: FOLDER,
  spreadsheet: "application/vnd.google-apps.spreadsheet",
  document: "application/vnd.google-apps.document",
} as const;

const folderInput = z.string().optional().describe("作る先のフォルダの ID か URL");

interface Target {
  email: string;
  auth: OAuth2Client;
  parentId?: string;
}

/**
 * 新しいファイルを作るアカウントと場所を決める（docs/decisions.md の 6）。既定のアカウントは置かない。
 * 1. フォルダの指定 → そのフォルダのアカウント
 * 2. 既存のファイルの指定 → そのファイルのアカウントで、同じフォルダ
 * 3. どちらもない → account の明示がなければエラーにして、ユーザーに聞かせる
 */
export const resolveCreateTarget = async (o: {
  parent?: string | undefined;
  near?: string | undefined;
  account?: string | undefined;
}): Promise<Target> => {
  if (o.parent) {
    const { id } = parseFileRef(o.parent);
    const { email, result } = await withGoogleFile(id, o.account, async (auth) => {
      const meta = await drive({ version: "v3", auth }).files.get({
        fileId: id,
        supportsAllDrives: true,
        fields: "mimeType",
      });
      if (meta.data.mimeType !== FOLDER) throw new Error(`parent に指定したものがフォルダではない: ${id}`);
      return auth;
    });
    return { email, auth: result, parentId: id };
  }
  if (o.near) {
    const { id } = parseFileRef(o.near);
    const { email, result } = await withGoogleFile(id, o.account, async (auth) => {
      const meta = await drive({ version: "v3", auth }).files.get({
        fileId: id,
        supportsAllDrives: true,
        fields: "parents",
      });
      return { auth, parentId: meta.data.parents?.[0] ?? undefined };
    });
    return { email, ...result };
  }
  if (o.account) return { email: o.account, auth: await authForEmail(o.account) };

  const emails = (await googleAccounts()).map((a) => a.email).join(", ");
  throw new Error(
    `作る先のアカウントを決められない。作る先のフォルダか、近くに置きたい既存のファイルが分かっていれば parent か near を指定する。分からなければ、どのアカウント（${emails}）に作るかをユーザーに聞いてから account を指定して呼び直す（そのときはマイドライブの直下に作る）`,
  );
};

export const driveCreate = defineTool({
  name: "drive_create",
  title: "ファイル・フォルダを作る",
  description:
    "空のスプレッドシート・Google ドキュメント・フォルダを作る。作る先は parent（フォルダ）か near（同じ場所に置きたい既存のファイル）で指定する。どちらも分からないときは、推測せずユーザーにどのアカウントに作るかを聞き、account を指定する。",
  risk: "write",
  inputSchema: z.object({
    name: z.string().min(1).describe("名前"),
    kind: z.enum(["spreadsheet", "document", "folder"]).describe("作るものの種類"),
    parent: folderInput,
    near: z.string().optional().describe("同じフォルダに作りたい既存のファイルの ID か URL"),
    account: accountInput,
  }),
  handler: async ({ name, kind, parent, near, account }, ctx) => {
    ctx.audit.fileName = name;
    const target = await resolveCreateTarget({ parent, near, account });
    ctx.audit.account = target.email;
    const res = await drive({ version: "v3", auth: target.auth }).files.create({
      requestBody: { name, mimeType: KINDS[kind], ...(target.parentId ? { parents: [target.parentId] } : {}) },
      supportsAllDrives: true,
      fields: FILE_FIELDS,
    });
    ctx.audit.fileId = res.data.id ?? undefined;
    if (target.parentId) ctx.audit.note = `parent=${target.parentId}`;
    await recordAccounts("google", [{ fileId: res.data.id!, email: target.email }]);
    return text({ account: target.email, ...res.data });
  },
});

export const driveCopy = defineTool({
  name: "drive_copy",
  title: "ファイルをコピーする",
  description:
    "ファイルをコピーする。元のファイルと同じアカウントに作る。parent を省略すると元のファイルと同じフォルダに置く。フォルダはコピーできない。",
  risk: "write",
  inputSchema: z.object({
    file: fileInput,
    name: z.string().min(1).optional().describe("コピーの名前。省略すると「元の名前 のコピー」"),
    parent: folderInput,
    account: accountInput,
  }),
  handler: async ({ file, name, parent, account }, ctx) => {
    const { id } = parseFileRef(file);
    const parentId = parent ? parseFileRef(parent).id : undefined;
    const { email, result } = await withGoogleFile(id, account, async (auth, email) => {
      ctx.audit.account = email;
      const d = drive({ version: "v3", auth });
      const source = await d.files.get({ fileId: id, supportsAllDrives: true, fields: "name,mimeType" });
      if (source.data.mimeType === FOLDER) throw new Error("フォルダはコピーできない");
      ctx.audit.note = `copy of ${id}（${source.data.name}）`;
      const copyName = name ?? `${source.data.name} のコピー`;
      ctx.audit.fileName = copyName;
      const res = await d.files.copy({
        fileId: id,
        requestBody: { name: copyName, ...(parentId ? { parents: [parentId] } : {}) },
        supportsAllDrives: true,
        fields: FILE_FIELDS,
      });
      return res.data;
    });
    ctx.audit.fileId = result.id ?? undefined;
    await recordAccounts("google", [{ fileId: result.id!, email }]);
    return text({ account: email, ...result });
  },
});

export const driveRename = defineTool({
  name: "drive_rename",
  title: "名前を変える",
  description: "ファイルやフォルダの名前を変える。",
  risk: "write",
  inputSchema: z.object({
    file: fileInput,
    name: z.string().min(1).describe("新しい名前"),
    account: accountInput,
  }),
  handler: async ({ file, name, account }, ctx) => {
    const { id } = parseFileRef(file);
    Object.assign(ctx.audit, { fileId: id, fileName: name });
    const { email, result } = await withGoogleFile(id, account, async (auth, email) => {
      ctx.audit.account = email;
      const d = drive({ version: "v3", auth });
      const before = await d.files.get({ fileId: id, supportsAllDrives: true, fields: "name" });
      ctx.audit.note = `renamed from ${before.data.name}`;
      const res = await d.files.update({
        fileId: id,
        requestBody: { name },
        supportsAllDrives: true,
        fields: FILE_FIELDS,
      });
      return { ...res.data, previousName: before.data.name };
    });
    return text({ account: email, ...result });
  },
});
