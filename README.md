# Multi-Account MCP

Claude Code・Claude Desktop から、同じサービスの複数アカウント（Google の個人用と仕事用など）を、
どのアカウントかを気にせず使うための MCP サーバー。

Claude のコネクタは1サービスにつき1アカウントしか繋げない。このサーバーは複数のアカウントにまとめて繋ぎ、
「このスプシを直して」と頼めば、そのファイルにアクセスできるアカウントを自動で選んで開く。

> **作者が自分のために作ったもので、ほかの人が使うことは想定していない。** 
> コードは自由に読んでよいが、サポートはしない。動かすには、自分で Google Cloud の OAuth クライアントを用意する必要がある。

## できること

今は Google の Drive とスプレッドシートに対応している。

- **アカウントの自動解決**：ファイル ID や URL で操作すると、アクセスできるアカウントを順に試し、どのファイルがどのアカウントかを覚える
- **横断検索**：すべてのアカウントの Drive をまとめて検索し、結果にアカウントを付けて返す
- **作り先の決め方**：新しいファイルは、指定したフォルダか、元にしたファイルと同じアカウントに作る。どちらも分からなければ、推測せずにユーザーに聞く

| 段 | ツール | すること |
|---|---|---|
| 読む | `list_accounts` | 繋がっているアカウントの一覧 |
| | `drive_search` | 全アカウントを横断して検索 |
| | `drive_read` | ファイルの中身を読む（Google ドキュメントはテキスト、スプシは CSV） |
| | `sheets_read` | スプシのセルの値を読む |
| 書く・作る | `sheets_write` | セルの値を書き換える |
| | `sheets_append` | 行を末尾に追加する |
| | `drive_create` | スプシ・ドキュメント・フォルダを作る |
| | `drive_copy` | ファイルをコピーする |
| | `drive_rename` | 名前を変える |
| 削除 | `drive_trash` | ゴミ箱へ移す（MCP の `destructiveHint` 付き） |

## 安全のための制限

Drive のフルアクセス権限を使う代わりに、ツールの側で次のように絞っている。

- 削除はゴミ箱への移動だけ（30日以内なら戻せる）。完全に削除するツールはない
- 共有設定を変えるツールはない
- ツールに危険度のヒント（`readOnlyHint` / `destructiveHint`）を付け、クライアント側で段ごとに許可を分けられる
- 書く・作る・削除の操作は `~/Library/Logs/multi-account-mcp.log` に1行ずつ残す。ファイルの中身、セルの値、トークンは書かない
- トークンは 1Password に置き、設定ファイルには秘密情報を書かない。1Password はセッションで最初に使うときに1回だけ読む（Touch ID の承認が要る）

データの扱いは [PRIVACY.md](PRIVACY.md) を参照。

## 必要なもの

- macOS（ログを `~/Library/Logs` に、トークンを 1Password に置く前提）
- [mise](https://mise.jdx.dev/)（Node はリポジトリの `mise.toml` で固定している）
- [1Password](https://1password.com/) のデスクトップアプリと CLI（`op`）。アプリの「設定 > 開発者」で「1Password CLI と連携」をオンにする
- Google Cloud の OAuth クライアント（作り方は [docs/setup-google.md](docs/setup-google.md)）
- Claude Code か Claude Desktop

## セットアップ

```sh
ghq get Alfr0475/multi-account-mcp
cd "$(ghq root)/github.com/Alfr0475/multi-account-mcp"
mise install
mise exec -- npm ci
mise exec -- npm run build
```

1. [docs/setup-google.md](docs/setup-google.md) の手順で OAuth クライアントを作り、1Password に入れる
2. アカウントごとにログインする（ブラウザが開く）
   ```sh
   mise exec -- node dist/cli.js login google
   ```
3. Claude Code と Claude Desktop に登録する（Claude Desktop は再起動で反映）
   ```sh
   mise exec -- node dist/cli.js register
   ```

## コマンド

| コマンド | すること |
|---|---|
| `login google` | Google のアカウントを足す |
| `logout google <メール>` | トークンを Google 側で取り消し、1Password と設定から消す |
| `register` | Claude Code（ユーザースコープ）と Claude Desktop に登録する |
| `unregister` | 両方から登録を外す |
| `serve` | MCP サーバーとして起動する（Claude から呼ばれる。手で打つことはない） |

いずれも `mise exec -- node dist/cli.js <コマンド>` で実行する。

Node を更新したときやコードを変えたときは、`npm run build` と `register` をやり直す。

## 開発

```sh
mise exec -- npm test           # テスト（ビルドせずに .ts のまま走る）
mise exec -- npm run typecheck  # 型チェック
```

- 設計：[docs/design.md](docs/design.md)
- 決めたことと理由：[docs/decisions.md](docs/decisions.md)
- コードの構成と開発のルール：[CLAUDE.md](CLAUDE.md)
