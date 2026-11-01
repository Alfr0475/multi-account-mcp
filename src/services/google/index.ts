import type { Service } from "../../core/service.ts";
import { login } from "./auth.ts";
import { driveCopy, driveCreate, driveRename } from "./drive-write.ts";
import { driveRead, driveSearch } from "./drive.ts";
import { sheetsAppend, sheetsRead, sheetsWrite } from "./sheets.ts";

export const google: Service = {
  name: "google",
  tools: [
    // 読む
    driveSearch,
    driveRead,
    sheetsRead,
    // 書く・作る
    sheetsWrite,
    sheetsAppend,
    driveCreate,
    driveCopy,
    driveRename,
  ],
  login,
};
