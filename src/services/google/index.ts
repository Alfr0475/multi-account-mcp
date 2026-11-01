import type { Service } from "../../core/service.ts";
import { login } from "./auth.ts";

export const google: Service = {
  name: "google",
  tools: [],
  login,
};
