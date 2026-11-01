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

export const recordAccounts = (service: string, entries: { fileId: string; email: string }[]): Promise<void> => {
  const next = writing.then(async () => {
    const index = await load();
    const changed = entries.filter((e) => index[key(service, e.fileId)] !== e.email);
    if (changed.length === 0) return;
    for (const e of changed) index[key(service, e.fileId)] = e.email;
    await mkdir(configDir(), { recursive: true, mode: 0o700 });
    const tmp = `${indexFile()}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(index) + "\n", { mode: 0o600 });
    await rename(tmp, indexFile());
  });
  writing = next.catch(() => undefined);
  return next;
};
