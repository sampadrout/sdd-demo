import type { ToolDefinition } from "../../types.js";
import { requirePage } from "../../browser/manager.js";
import { appendSteps } from "../append-steps.js";

export const liveNavigate: ToolDefinition = {
  name: "cypress_live_navigate",
  description: "Navigate the live browser to a URL. Set appendToSpec:true to also record `cy.visit(url)` in the current spec.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string" },
      waitUntil: {
        type: "string",
        enum: ["load", "domcontentloaded", "networkidle", "commit"],
      },
      appendToSpec: { type: "boolean" },
    },
    required: ["url"],
    additionalProperties: false,
  },
  handler: async (args) => {
    const page = await requirePage();
    const url = String(args.url);
    await page.goto(url, { waitUntil: (args.waitUntil as never) ?? "load" });
    if (args.appendToSpec) {
      await appendSteps.handler({ steps: [{ action: "visit", url }] });
    }
    return {
      content: [
        { type: "text", text: JSON.stringify({ url: page.url(), title: await page.title() }) },
      ],
    };
  },
};

export const liveGoBack: ToolDefinition = {
  name: "cypress_live_go_back",
  description: "Go back one step in browser history.",
  inputSchema: {
    type: "object",
    properties: { appendToSpec: { type: "boolean" } },
    additionalProperties: false,
  },
  handler: async (args) => {
    const page = await requirePage();
    await page.goBack();
    if (args.appendToSpec) await appendSteps.handler({ steps: [{ action: "go_back" }] });
    return { content: [{ type: "text", text: page.url() }] };
  },
};

export const liveReload: ToolDefinition = {
  name: "cypress_live_reload",
  description: "Reload the live browser page.",
  inputSchema: {
    type: "object",
    properties: { appendToSpec: { type: "boolean" } },
    additionalProperties: false,
  },
  handler: async (args) => {
    const page = await requirePage();
    await page.reload();
    if (args.appendToSpec) await appendSteps.handler({ steps: [{ action: "reload" }] });
    return { content: [{ type: "text", text: page.url() }] };
  },
};
