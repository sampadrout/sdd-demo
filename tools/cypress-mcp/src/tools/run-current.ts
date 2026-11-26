import path from "node:path";
import type { ToolDefinition } from "../types.js";
import { getSession } from "../session.js";
import { run } from "./run.js";

export const runCurrent: ToolDefinition = {
  name: "cypress_run_current",
  description:
    "Run only the session's current spec headlessly. Thin wrapper over cypress_run with --spec set to the current spec path.",
  inputSchema: {
    type: "object",
    properties: {
      browser: { type: "string" },
      headed: { type: "boolean" },
      testingType: { type: "string", enum: ["e2e", "component"] },
      env: { type: "object", additionalProperties: true },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const s = getSession();
    if (!s.currentSpec) {
      return {
        content: [{ type: "text", text: "No current spec. Call cypress_new_spec first." }],
        isError: true,
      };
    }
    return run.handler({
      projectRoot: s.projectRoot,
      spec: path.relative(s.projectRoot, s.currentSpec),
      browser: args.browser,
      headed: args.headed,
      testingType: args.testingType,
      env: args.env,
    });
  },
};
