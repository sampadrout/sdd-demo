import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition } from "../types.js";
import { getLastRun } from "../state.js";
import { resolveProjectRoot } from "../util/project.js";

const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

export const getVideo: ToolDefinition = {
  name: "cypress_get_video",
  description:
    "Return the video recording for a spec from the last run. Cypress records videos by default when running headlessly. Returns the path and size (not the binary, which can be huge).",
  inputSchema: {
    type: "object",
    properties: {
      specFilter: { type: "string", description: "Substring of the spec's relative path." },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const last = getLastRun();
    if (!last) {
      return { content: [{ type: "text", text: "No cached run. Call cypress_run first." }], isError: true };
    }
    const needle = (args.specFilter as string | undefined)?.toLowerCase();
    const videos: Array<{ spec: string; video: string; size?: number }> = [];
    for (const r of last.runs) {
      if (!r.video) continue;
      if (needle && !r.spec.relative.toLowerCase().includes(needle)) continue;
      const info = await stat(r.video).catch(() => null);
      videos.push({ spec: r.spec.relative, video: r.video, size: info?.size });
      if (info && info.size > MAX_VIDEO_BYTES) continue;
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ count: videos.length, videos }, null, 2),
        },
      ],
    };
  },
};

/**
 * Cypress doesn't persist browser-console messages to disk by default. The
 * idiomatic way to capture them is a support-file hook that forwards console
 * output to cy.task. This tool reads a log file written by that hook.
 *
 * See cypress_install_log_hooks for the support snippet to install.
 */
export const getConsoleMessages: ToolDefinition = {
  name: "cypress_get_console_messages",
  description:
    "Read captured browser console messages from the last run. Requires the log hook to be installed via cypress_install_log_hooks (writes cypress/logs/console.json).",
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: { type: "string" },
      level: {
        type: "string",
        enum: ["log", "info", "warn", "error", "debug"],
        description: "Filter messages by level.",
      },
      logPath: {
        type: "string",
        description: "Override log path (default cypress/logs/console.json).",
      },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const projectRoot = resolveProjectRoot(args.projectRoot as string | undefined);
    const logPath = (args.logPath as string | undefined) ??
      path.join(projectRoot, "cypress", "logs", "console.json");
    const info = await stat(logPath).catch(() => null);
    if (!info) {
      return {
        content: [
          {
            type: "text",
            text: `No console log at ${logPath}. Install the hook with cypress_install_log_hooks and re-run.`,
          },
        ],
        isError: true,
      };
    }
    const raw = await readFile(logPath, "utf8");
    const entries = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as { level: string; args: unknown[]; ts: number; spec?: string };
        } catch {
          return null;
        }
      })
      .filter((x): x is { level: string; args: unknown[]; ts: number; spec?: string } => !!x);
    const filtered = args.level ? entries.filter((e) => e.level === args.level) : entries;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ count: filtered.length, messages: filtered.slice(-500) }, null, 2),
        },
      ],
    };
  },
};

export const getNetworkRequests: ToolDefinition = {
  name: "cypress_get_network_requests",
  description:
    "Read captured network requests from the last run. Requires the network hook from cypress_install_log_hooks (uses cy.intercept + cy.task to persist to cypress/logs/network.json).",
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: { type: "string" },
      filter: { type: "string", description: "Only return requests whose URL matches this substring." },
      logPath: { type: "string" },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const projectRoot = resolveProjectRoot(args.projectRoot as string | undefined);
    const logPath = (args.logPath as string | undefined) ??
      path.join(projectRoot, "cypress", "logs", "network.json");
    const info = await stat(logPath).catch(() => null);
    if (!info) {
      return {
        content: [
          {
            type: "text",
            text: `No network log at ${logPath}. Install the hook with cypress_install_log_hooks and re-run.`,
          },
        ],
        isError: true,
      };
    }
    const raw = await readFile(logPath, "utf8");
    const entries = raw
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((x): x is Record<string, unknown> => !!x);
    const needle = (args.filter as string | undefined)?.toLowerCase();
    const filtered = needle
      ? entries.filter((e) => String(e.url ?? "").toLowerCase().includes(needle))
      : entries;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ count: filtered.length, requests: filtered.slice(-500) }, null, 2),
        },
      ],
    };
  },
};
