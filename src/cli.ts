#!/usr/bin/env node
import { login } from "./commands/login.ts";
import { createServer } from "./core/server.ts";
import { google } from "./services/google/index.ts";
import { serveStdio } from "./transport/stdio.ts";

const usage = `使い方: multi-account-mcp <コマンド>

  serve             MCP サーバーとして起動する（Claude Code・Claude Desktop から呼ばれる）
  login <サービス>   ブラウザでログインし、トークンを 1Password に保存する（例: login google）
  logout            トークンを Google 側で取り消し、1Password から消す
  register          Claude Code と Claude Desktop にサーバーを登録する
  unregister        Claude Code と Claude Desktop から登録を外す
`;

const services = [google];

const [command, arg] = process.argv.slice(2);

const findService = (name: string | undefined) => {
  const service = services.find((s) => s.name === name);
  if (!service) {
    console.error(`サービスを指定してください: ${services.map((s) => s.name).join(" | ")}`);
    process.exit(1);
  }
  return service;
};

switch (command) {
  case "serve":
    await serveStdio(createServer(services));
    break;
  case "login":
    await login(findService(arg));
    break;
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
