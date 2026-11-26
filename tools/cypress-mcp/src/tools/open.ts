import { spawn } from "node:child_process";
import path from "node:path";
import type { ToolDefinition } from "../types.js";
import { resolveProjectRoot } from "../util/project.js";
import { getSession, setOpenProcess } from "../session.js";

export const open: ToolDefinition = {
  name: "cypress_open",
  description:
    "Launch the interactive Cypress runner (cypress open) as a background process. Useful for visual debugging, recording via Cypress Studio, or spec authoring. Call cypress_close to terminate.",
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: { type: "string" },
      browser: { type: "string" },
      testingType: { type: "string", enum: ["e2e", "component"] },
      configFile: { type: "string" },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const projectRoot = resolveProjectRoot(args.projectRoot as string | undefined);
    const session = getSession();
    if (session.openProcess) {
      return {
        content: [
          {
            type: "text",
            text: `Cypress already open (pid ${session.openProcess.pid}, since ${session.openProcess.startedAt}). Call cypress_close first.`,
          },
        ],
        isError: true,
      };
    }
    const cypressBin = path.join(projectRoot, "node_modules", ".bin", "cypress");
    const cmdArgs = ["open", "--project", projectRoot];
    if (args.testingType) cmdArgs.push("--e2e"); // --e2e or --component; adjust below
    if (args.testingType === "component") {
      cmdArgs.pop();
      cmdArgs.push("--component");
    }
    if (args.browser) cmdArgs.push("--browser", args.browser as string);
    if (args.configFile) cmdArgs.push("--config-file", args.configFile as string);

    const proc = spawn(cypressBin, cmdArgs, {
      cwd: projectRoot,
      detached: true,
      stdio: "ignore",
    });
    proc.unref();
    if (!proc.pid) {
      return { content: [{ type: "text", text: "Failed to spawn cypress open." }], isError: true };
    }
    const startedAt = new Date().toISOString();
    setOpenProcess({ pid: proc.pid, startedAt });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ pid: proc.pid, startedAt, cmd: `${cypressBin} ${cmdArgs.join(" ")}` }, null, 2),
        },
      ],
    };
  },
};

export const close: ToolDefinition = {
  name: "cypress_close",
  description: "Terminate the interactive Cypress process started by cypress_open.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  handler: async () => {
    const session = getSession();
    if (!session.openProcess) {
      return { content: [{ type: "text", text: "No open Cypress process." }] };
    }
    try {
      process.kill(session.openProcess.pid);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setOpenProcess(null);
      return { content: [{ type: "text", text: `Could not kill pid ${session.openProcess.pid}: ${msg}` }], isError: true };
    }
    const pid = session.openProcess.pid;
    setOpenProcess(null);
    return { content: [{ type: "text", text: `Killed cypress pid ${pid}.` }] };
  },
};
