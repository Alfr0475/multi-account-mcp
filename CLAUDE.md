# Multi-Account MCP

Claude Code・Claude Desktop から、同じサービスの複数アカウント（Google の個人用と仕事用など）を、
どのアカウントかを気にせず使えるようにする自分専用の MCP サーバー。公開も収益化もしない。

## 設計ドキュメント

設計の正本はこのリポジトリ。実装中に仕様が変わったら、ここを直す。

| ファイル | 内容 |
|---|---|
| `docs/design.md` | 何を作るか（設計書） |
| `docs/decisions.md` | 決めたこと・理由・退けた案 |

**`docs/decisions.md` で退けた案は出さない。変えたいときは、先にユーザーに確認する。**

## 開発環境

Dev Container は使わず、Mac の上で直接開発する（`docs/decisions.md` の 20）。Mac を汚さないため、次を守る。

- Node はリポジトリ直下の `mise.toml` で固定している。Bash ツールでは `mise exec -- npm ...` のように呼ぶ
- Node はその時点の LTS を使い、セキュリティリリースが出たらパッチ版を上げる（上げたら `register` を打ち直す）。LTS かどうかは https://nodejs.org/dist/index.json の `lts` で確かめる（mise の `lts` は更新が遅れることがある）
- `npm -g` は使わない。ツールは devDependencies に入れて `npm run` / `npx` で呼ぶ
- `.npmrc` の `ignore-scripts=true` を外さない。依存を足すときは本当に要るかを先に考える
- テストや開発中は、設定フォルダとログを環境変数で一時ディレクトリに向け、本番の `~/.config/multi-account-mcp/` と `~/Library/Logs/multi-account-mcp.log` を汚さない

## コマンド

| コマンド | すること |
|---|---|
| `mise exec -- npm ci` | 依存を入れる（lockfile どおり） |
| `mise exec -- npm test` | テスト（ビルドせずに `.ts` のまま走る） |
| `mise exec -- npm run typecheck` | 型チェック |
| `mise exec -- npm run build` | `dist/` にビルドする。Claude に登録するのは `dist/cli.js serve` |

## コードの構成

- `src/transport/`：通信の層（今は stdio だけ）
- `src/core/`：共通の層。ツールの危険度（`read` / `write` / `destructive`）は `core/service.ts` の `Risk` で持ち、MCP のヒントはそこから自動で付く
- `src/services/<サービス>/`：サービス層
- 相対 import は `.ts` まで書く（Node がそのまま実行し、ビルド時に `.js` に書き換わる）
- 標準出力は MCP の通信に使う。`serve` の中で `console.log` を使わない

## 最初のタスク

- [x] 開発環境を決める（Dev Container の指針を踏まえて）
- [x] 要調査：Claude Desktop から起動したプロセスで、`op` の Touch ID 承認がちゃんと出るか
- [x] Google Cloud で OAuth クライアントを作って「外部」「本番」にし、Workspace の管理コンソールでこのアプリを信頼済みにする
- [x] 3層（通信・共通・サービス）の骨組みと、stdio の MCP サーバーを作る
- [x] `login`：ブラウザで Google にログインし、トークンを 1Password に保存する
- [ ] `register`・`unregister` と `list_accounts`：Claude Code・Claude Desktop に登録し、Claude からアカウント一覧が見える状態にする
- [ ] 読むツール（`drive_search`、`drive_read`、`sheets_read`）と、アカウントの自動解決（ファイル→アカウントの記録）
- [ ] 書く・作るツール（`sheets_write`、`sheets_append`、`drive_create`、`drive_copy`、`drive_rename`）と操作ログ
- [ ] `drive_trash`（`destructiveHint` を付ける）
- [ ] `logout`：トークンを Google 側で取り消してから 1Password から消す
