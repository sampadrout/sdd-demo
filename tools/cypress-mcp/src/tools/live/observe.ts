import type { ToolDefinition } from "../../types.js";
import { clearBuffers, consoleMessages, networkRequests, requirePage } from "../../browser/manager.js";

export const liveWaitFor: ToolDefinition = {
  name: "cypress_live_wait_for",
  description: "Wait for a condition in the live browser: text to appear, selector to appear, or time to pass.",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "Text to wait for on the page." },
      textGone: { type: "string", description: "Text that should disappear." },
      selector: { type: "string", description: "Selector to wait for." },
      state: {
        type: "string",
        enum: ["attached", "detached", "visible", "hidden"],
        description: "Selector state to wait for (with selector).",
      },
      time: { type: "number", description: "Seconds to wait (ignored if text/selector provided)." },
      timeoutSeconds: { type: "number", description: "Default 30." },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const page = await requirePage();
    const timeout = ((args.timeoutSeconds as number | undefined) ?? 30) * 1000;
    try {
      if (args.text) {
        await page.waitForFunction(
          (t) => document.body?.innerText?.includes(String(t)),
          String(args.text),
          { timeout },
        );
      } else if (args.textGone) {
        await page.waitForFunction(
          (t) => !document.body?.innerText?.includes(String(t)),
          String(args.textGone),
          { timeout },
        );
      } else if (args.selector) {
        await page.waitForSelector(String(args.selector), {
          state: (args.state as never) ?? "visible",
          timeout,
        });
      } else if (args.time !== undefined) {
        await page.waitForTimeout(Number(args.time) * 1000);
      } else {
        return { content: [{ type: "text", text: "Provide text, textGone, selector, or time." }], isError: true };
      }
      return { content: [{ type: "text", text: "ok" }] };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text", text: `wait_for failed: ${msg}` }], isError: true };
    }
  },
};

export const liveConsoleMessages: ToolDefinition = {
  name: "cypress_live_console_messages",
  description: "Return browser console messages captured since the live browser launched.",
  inputSchema: {
    type: "object",
    properties: {
      level: { type: "string", enum: ["log", "info", "warn", "error", "debug"] },
      limit: { type: "number", description: "Max entries to return (most recent first). Default 200." },
      clear: { type: "boolean", description: "Clear the buffer after reading." },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const all = consoleMessages(args.level as string | undefined);
    const limit = (args.limit as number | undefined) ?? 200;
    const slice = all.slice(-limit);
    if (args.clear) clearBuffers();
    return {
      content: [{ type: "text", text: JSON.stringify({ count: slice.length, messages: slice }, null, 2) }],
    };
  },
};

export const liveNetworkRequests: ToolDefinition = {
  name: "cypress_live_network_requests",
  description: "Return network requests captured in the live browser since launch.",
  inputSchema: {
    type: "object",
    properties: {
      filter: { type: "string", description: "Substring of URL to match." },
      limit: { type: "number", description: "Max entries. Default 200." },
      includeStatic: {
        type: "boolean",
        description: "Include image/font/css/script requests. Defaults to false.",
      },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    let entries = networkRequests(args.filter as string | undefined);
    if (!args.includeStatic) {
      entries = entries.filter(
        (e) => !["image", "font", "stylesheet", "script", "media"].includes(e.resourceType ?? ""),
      );
    }
    const limit = (args.limit as number | undefined) ?? 200;
    const slice = entries.slice(-limit);
    return {
      content: [{ type: "text", text: JSON.stringify({ count: slice.length, requests: slice }, null, 2) }],
    };
  },
};
