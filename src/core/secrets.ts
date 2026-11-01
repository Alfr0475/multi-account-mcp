import { spawn } from "node:child_process";

export interface SecretField {
  label: string;
  value: string;
  concealed: boolean;
}

/** 秘密情報の保管場所。1Password 以外に差し替えられるよう、ここだけを通す */
export interface SecretStore {
  /** item は項目の題名か ID */
  read(item: string, field: string): Promise<string>;
  /** 作った項目の ID を返す */
  create(title: string, fields: SecretField[]): Promise<string>;
  remove(item: string): Promise<void>;
}

/**
 * 1Password（op CLI）。呼ぶたびに承認が要ることがあるので、読んだ値は呼び出し側でメモリに持つ。
 * Claude Desktop はシェルの設定を読まずに起動するので、op は MULTI_ACCOUNT_MCP_OP の絶対パスで呼ぶ。
 */
export class OnePasswordStore implements SecretStore {
  readonly #op: string;
  readonly #account: string;
  readonly #vault: string;

  constructor(account: string, vault: string, op = process.env.MULTI_ACCOUNT_MCP_OP ?? "op") {
    this.#op = op;
    this.#account = account;
    this.#vault = vault;
  }

  async read(item: string, field: string): Promise<string> {
    return this.#run(["read", "--no-newline", `op://${this.#vault}/${item}/${field}`]);
  }

  async create(title: string, fields: SecretField[]): Promise<string> {
    // 値をコマンドライン引数に載せると ps で見えるので、項目の JSON を標準入力で渡す。
    // spawn の標準入力はソケットで、op はパイプとして扱わない（`-` だと無視される）ので、/dev/stdin をファイルとして読ませる
    const template = {
      title,
      category: "SECURE_NOTE",
      fields: fields.map((f) => ({
        id: f.label,
        label: f.label,
        type: f.concealed ? "CONCEALED" : "STRING",
        value: f.value,
      })),
    };
    const out = await this.#run(["item", "create", "--template", "/dev/stdin", "--vault", this.#vault, "--format", "json"], JSON.stringify(template));
    return (JSON.parse(out) as { id: string }).id;
  }

  async remove(item: string): Promise<void> {
    await this.#run(["item", "delete", item, "--vault", this.#vault]);
  }

  #run(args: string[], input?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.#op, [...args, "--account", this.#account], {
        stdio: ["pipe", "pipe", "pipe"],
        // Touch ID の承認を待つことがあるので長めに待つ
        timeout: 120_000,
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => (stdout += d));
      child.stderr.on("data", (d) => (stderr += d));
      child.on("error", reject);
      child.on("close", (code) => {
        // エラーにはサブコマンドだけを載せ、標準入力で渡した値は載せない
        if (code === 0) resolve(stdout);
        else reject(new Error(`op ${args[0]} ${args[1] ?? ""} が失敗した（${code}）: ${stderr.trim()}`));
      });
      child.stdin.end(input ?? "");
    });
  }
}
