export interface FileRef {
  id: string;
  /** スプレッドシートの URL に付いているシートの ID */
  gid?: number;
}

/** ファイル ID か、Google ドキュメント・スプレッドシート・Drive の URL から ID を取り出す */
export const parseFileRef = (input: string): FileRef => {
  const text = input.trim();
  if (!/^https?:\/\//.test(text)) return { id: text };

  const url = new URL(text);
  const id =
    url.pathname.match(/\/(?:d|folders)\/([\w-]+)/)?.[1] ??
    // drive.google.com/open?id=... の形
    url.searchParams.get("id");
  if (!id) throw new Error(`URL からファイル ID を読み取れなかった: ${text}`);

  const gid = (url.hash.match(/gid=(\d+)/) ?? url.search.match(/gid=(\d+)/))?.[1];
  return gid === undefined ? { id } : { id, gid: Number(gid) };
};
