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

未決。最初のタスクで決める（候補は `docs/design.md` の「懸念点・リスク」にある案1・案2）。

## 最初のタスク

- [ ] 開発環境を決める（Dev Container の指針を踏まえて）
- [ ] 要調査：Claude Desktop から起動したプロセスで、`op` の Touch ID 承認がちゃんと出るか
- [ ] Google Cloud で OAuth クライアントを作って「外部」「本番」にし、Workspace の管理コンソールでこのアプリを信頼済みにする
- [ ] 3層（通信・共通・サービス）の骨組みと、stdio の MCP サーバーを作る
- [ ] `login`：ブラウザで Google にログインし、トークンを 1Password に保存する
- [ ] `register` と `list_accounts`：Claude Code・Claude Desktop に登録し、Claude からアカウント一覧が見える状態にする
- [ ] 読むツール（`drive_search`、`drive_read`、`sheets_read`）と、アカウントの自動解決（ファイル→アカウントの記録）
- [ ] 書く・作るツール（`sheets_write`、`sheets_append`、`drive_create`、`drive_copy`、`drive_rename`）と操作ログ
- [ ] `drive_trash`（`destructiveHint` を付ける）
- [ ] `logout`：トークンを Google 側で取り消してから 1Password から消す
