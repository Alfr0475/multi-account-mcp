import { z } from "zod";
import { loadConfig } from "./config.ts";
import { defineTool } from "./service.ts";

export const listAccounts = defineTool({
  name: "list_accounts",
  title: "アカウント一覧",
  description:
    "繋がっているアカウントの一覧（サービスとメールアドレス）を返す。普段はアカウントを選ばなくても自動で解決されるので、明示したいときや、どのアカウントがあるかを知りたいときに使う。",
  risk: "read",
  inputSchema: z.object({}),
  handler: async () => {
    // 動いている間に login で増えることがあるので、毎回読む
    const { accounts } = await loadConfig();
    const list = accounts.map(({ service, email }) => ({ service, email }));
    return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
  },
});
