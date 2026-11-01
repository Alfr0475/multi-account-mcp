import { execFile } from "node:child_process";
import { promisify } from "node:util";

/** 秘密情報の保管場所。1Password 以外に差し替えられるよう、ここだけを通す */
export interface SecretStore {
  read(ref: string): Promise<string>;
}

const run = promisify(execFile);

/**
 * 1Password（op CLI）。呼ぶたびに承認が要ることがあるので、読んだ値は呼び出し側でメモリに持つ。
 * Claude Desktop はシェルの設定を読まずに起動するので、op は MULTI_ACCOUNT_MCP_OP の絶対パスで呼ぶ。
 */
export class OnePasswordStore implements SecretStore {
  readonly #op: string;
  readonly #account: string;

  constructor(account: string, op = process.env.MULTI_ACCOUNT_MCP_OP ?? "op") {
    this.#op = op;
    this.#account = account;
  }

  async read(ref: string): Promise<string> {
    // Touch ID の承認を待つことがあるので長めに待つ
    const { stdout } = await run(this.#op, ["read", "--no-newline", "--account", this.#account, ref], {
      timeout: 120_000,
    });
    return stdout;
  }
}
