import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { configDir } from "./paths.ts";

// 「どのファイルがどのアカウントか」の記録。キャッシュなので、消えても使ううちに作り直される

type Index = Record<string, string>;

const indexFile = () => join(configDir(), "files.json");
const key = (service: string, fileId: string) => `${service}:${fileId}`;

const load = async (): Promise<Index> => {
  try {
    return JSON.parse(await readFile(indexFile(), "utf8")) as Index;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw e;
  }
};

// 同じプロセスの中で書き込みが重ならないよう、順番に行う
let writing: Promise<void> = Promise.resolve();

export const recordedAccount = async (service: string, fileId: string): Promise<string | undefined> =>
  (await load())[key(service, fileId)];

/** 記録を書き換える。update が false を返したら書かない */
const modify = (update: (index: Index) => boolean): Promise<void> => {
  const next = writing.then(async () => {
    const index = await load();
    if (!update(index)) return;
    await mkdir(configDir(), { recursive: true, mode: 0o700 });
    const tmp = `${indexFile()}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(index) + "\n", { mode: 0o600 });
    await rename(tmp, indexFile());
  });
  writing = next.catch(() => undefined);
  return next;
};

export const recordAccounts = (service: string, entries: { fileId: string; email: string }[]): Promise<void> =>
  modify((index) => {
    const changed = entries.filter((e) => index[key(service, e.fileId)] !== e.email);
    for (const e of changed) index[key(service, e.fileId)] = e.email;
    return changed.length > 0;
  });

/** logout したアカウントの記録を消す */
export const forgetAccount = (service: string, email: string): Promise<void> =>
  modify((index) => {
    const keys = Object.keys(index).filter((k) => k.startsWith(`${service}:`) && index[k] === email);
    for (const k of keys) delete index[k];
    return keys.length > 0;
  });
