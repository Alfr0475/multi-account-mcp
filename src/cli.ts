#!/usr/bin/env node
import { createServer } from "./core/server.ts";
import { google } from "./services/google/index.ts";
import { serveStdio } from "./transport/stdio.ts";

const usage = `使い方: multi-account-mcp <コマンド>

  serve        MCP サーバーとして起動する（Claude Code・Claude Desktop から呼ばれる）
  login        Google にログインし、トークンを 1Password に保存する
  logout       トークンを Google 側で取り消し、1Password から消す
  register     Claude Code と Claude Desktop にサーバーを登録する
  unregister   Claude Code と Claude Desktop から登録を外す
`;

const [command] = process.argv.slice(2);

switch (command) {
  case "serve":
    await serveStdio(createServer([google]));
    break;
  case "login":
  case "logout":
  case "register":
  case "unregister":
    console.error(`${command} はまだ作っていない`);
    process.exitCode = 1;
    break;
  default:
    console.error(usage);
    process.exitCode = command === undefined ? 0 : 1;
}
