import type { ToolDefinition } from "../../types.js";
import { requirePage } from "../../browser/manager.js";

export const liveSnapshot: ToolDefinition = {
  name: "cypress_live_snapshot",
  description:
    "Return an accessibility snapshot of the live page as YAML (Playwright ariaSnapshot). Agent-friendly structured data (role + name + state) for navigation without screenshots.",
  inputSchema: {
    type: "object",
    properties: {
      selector: { type: "string", description: "Root selector. Defaults to 'body'." },
      maxChars: { type: "number", description: "Truncate the snapshot string. Default 20000." },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const page = await requirePage();
    const root = (args.selector as string | undefined) ?? "body";
    const snapshot = await page.locator(root).ariaSnapshot();
    const maxChars = (args.maxChars as number | undefined) ?? 20000;
    const truncated = snapshot.length > maxChars ? snapshot.slice(0, maxChars) + "\n# ... truncated" : snapshot;
    const url = page.url();
    const title = await page.title();
    return {
      content: [{ type: "text", text: `# ${title}\n# ${url}\n\n${truncated}` }],
    };
  },
};

export const liveScreenshot: ToolDefinition = {
  name: "cypress_live_screenshot",
  description: "Take a screenshot of the live page.",
  inputSchema: {
    type: "object",
    properties: {
      fullPage: { type: "boolean" },
      selector: { type: "string", description: "Optional CSS/role selector to screenshot just that element." },
      type: { type: "string", enum: ["png", "jpeg"] },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const page = await requirePage();
    const type = (args.type as "png" | "jpeg" | undefined) ?? "png";
    let buf: Buffer;
    if (args.selector) {
      buf = await page.locator(String(args.selector)).screenshot({ type });
    } else {
      buf = await page.screenshot({ fullPage: Boolean(args.fullPage), type });
    }
    return {
      content: [
        { type: "text", text: `screenshot ${buf.length} bytes` },
        { type: "image", data: buf.toString("base64"), mimeType: type === "jpeg" ? "image/jpeg" : "image/png" },
      ],
    };
  },
};
