import { spawn } from "node:child_process";
import type { ToolDefinition } from "../../types.js";
import { close, isLaunched, launch, requirePage } from "../../browser/manager.js";

export const liveLaunch: ToolDefinition = {
  name: "cypress_live_launch",
  description:
    "Launch a persistent browser (Playwright-driven) for exploration and locator discovery. Runs in parallel to Cypress — use live tools to drive the browser, then append equivalent cy.* code to the current spec via appendToSpec:true.",
  inputSchema: {
    type: "object",
    properties: {
      browser: { type: "string", enum: ["chromium", "firefox", "webkit"], description: "Defaults to chromium." },
      headless: { type: "boolean", description: "Defaults to false so the user can watch." },
      viewport: {
        type: "object",
        properties: { width: { type: "number" }, height: { type: "number" } },
        additionalProperties: false,
      },
      userAgent: { type: "string" },
      storageStatePath: { type: "string", description: "Path to Playwright storage state JSON." },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    if (await isLaunched()) {
      return { content: [{ type: "text", text: "Live browser already running. Call cypress_live_close to reset." }] };
    }
    try {
      const info = await launch({
        kind: args.browser as "chromium" | "firefox" | "webkit" | undefined,
        headless: args.headless as boolean | undefined,
        viewport: args.viewport as { width: number; height: number } | undefined,
        userAgent: args.userAgent as string | undefined,
        storageStatePath: args.storageStatePath as string | undefined,
      });
      return { content: [{ type: "text", text: JSON.stringify({ launched: true, ...info }, null, 2) }] };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text", text: msg }], isError: true };
    }
  },
};

export const liveClose: ToolDefinition = {
  name: "cypress_live_close",
  description: "Close the live browser.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  handler: async () => {
    await close();
    return { content: [{ type: "text", text: "closed" }] };
  },
};

export const liveResize: ToolDefinition = {
  name: "cypress_live_resize",
  description: "Resize the live browser viewport.",
  inputSchema: {
    type: "object",
    properties: {
      width: { type: "number" },
      height: { type: "number" },
    },
    required: ["width", "height"],
    additionalProperties: false,
  },
  handler: async (args) => {
    const page = await requirePage();
    await page.setViewportSize({ width: Number(args.width), height: Number(args.height) });
    return { content: [{ type: "text", text: `viewport ${args.width}x${args.height}` }] };
  },
};

export const liveInstallBrowsers: ToolDefinition = {
  name: "cypress_live_install_browsers",
  description:
    "Run `npx playwright install <kind>` to download the browser binary if missing. Use after cypress_live_launch reports 'browser binary missing'.",
  inputSchema: {
    type: "object",
    properties: { kind: { type: "string", enum: ["chromium", "firefox", "webkit"] } },
    additionalProperties: false,
  },
  handler: async (args) => {
    const kind = (args.kind as string | undefined) ?? "chromium";
    return new Promise((resolve) => {
      const proc = spawn("npx", ["playwright", "install", kind], { stdio: "pipe" });
      let out = "";
      proc.stdout.on("data", (c) => (out += c.toString()));
      proc.stderr.on("data", (c) => (out += c.toString()));
      proc.on("close", (code) => {
        resolve({
          content: [{ type: "text", text: `exit ${code}\n${out.slice(-4000)}` }],
          isError: code !== 0,
        });
      });
    });
  },
};
