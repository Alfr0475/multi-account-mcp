import type { Service } from "../../core/service.ts";
import { login } from "./auth.ts";
import { driveRead, driveSearch } from "./drive.ts";
import { sheetsRead } from "./sheets.ts";

export const google: Service = {
  name: "google",
  tools: [driveSearch, driveRead, sheetsRead],
  login,
};
