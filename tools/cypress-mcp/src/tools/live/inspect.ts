import type { ToolDefinition } from "../../types.js";
import { requirePage } from "../../browser/manager.js";
import { PICKER_SCRIPT } from "../../browser/picker-script.js";
import { suggestionsFromAttrs, type ElementAttrs } from "../../browser/locator-suggest.js";

export const livePickLocator: ToolDefinition = {
  name: "cypress_live_pick_locator",
  description:
    "Wait for the user to click an element in the live browser. Returns its outerHTML and ranked Cypress selector suggestions (data-cy > data-testid > id > role+name > tag+text).",
  inputSchema: {
    type: "object",
    properties: {
      timeoutSeconds: { type: "number", description: "Default 60." },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const page = await requirePage();
    const timeoutMs = ((args.timeoutSeconds as number | undefined) ?? 60) * 1000;
    try {
      await page.evaluate(PICKER_SCRIPT);
      await page.waitForFunction(
        `window.__mcpLastPick !== null && window.__mcpLastPick !== undefined`,
        undefined,
        { timeout: timeoutMs },
      );
      const picked = await page.evaluate(
        `(() => { const p = window.__mcpLastPick; window.__mcpLastPick = null; return p; })()`,
      ) as { attrs: ElementAttrs; outerHTML: string; boundingBox: Record<string, number> };
      const suggestions = suggestionsFromAttrs(picked.attrs);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                best: suggestions[0]?.cypress ?? `cy.get(${JSON.stringify(picked.attrs.tag ?? "*")})`,
                suggestions,
                attrs: picked.attrs,
                outerHTML: picked.outerHTML,
                boundingBox: picked.boundingBox,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text", text: `pick_locator failed: ${msg}` }], isError: true };
    }
  },
};

export const liveHighlight: ToolDefinition = {
  name: "cypress_live_highlight",
  description: "Draw a persistent outline around every element matching a CSS selector, for visual confirmation.",
  inputSchema: {
    type: "object",
    properties: {
      selector: { type: "string" },
      style: { type: "string", description: "Inline CSS applied to the overlay." },
    },
    required: ["selector"],
    additionalProperties: false,
  },
  handler: async (args) => {
    const page = await requirePage();
    const count = await page.evaluate(
      ([sel, style]: [string, string]) => {
        const existing = document.querySelectorAll("[data-mcp-highlight]");
        existing.forEach((e) => e.remove());
        const targets = Array.from(document.querySelectorAll(sel));
        targets.forEach((el, i) => {
          const r = (el as Element).getBoundingClientRect();
          const ov = document.createElement("div");
          ov.setAttribute("data-mcp-highlight", String(i));
          ov.style.cssText =
            `position:fixed;pointer-events:none;z-index:2147483646;box-sizing:border-box;` +
            `top:${r.top}px;left:${r.left}px;width:${r.width}px;height:${r.height}px;` +
            (style || "outline:2px solid #00bcd4;background:rgba(0,188,212,0.08);");
          document.documentElement.appendChild(ov);
        });
        return targets.length;
      },
      [String(args.selector), (args.style as string | undefined) ?? ""] as [string, string],
    );
    return { content: [{ type: "text", text: JSON.stringify({ selector: args.selector, matched: count }) }] };
  },
};

export const liveHideHighlight: ToolDefinition = {
  name: "cypress_live_hide_highlight",
  description: "Remove all highlight overlays added by cypress_live_highlight.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  handler: async () => {
    const page = await requirePage();
    const removed = await page.evaluate(() => {
      const existing = document.querySelectorAll("[data-mcp-highlight]");
      existing.forEach((e) => e.remove());
      return existing.length;
    });
    return { content: [{ type: "text", text: `removed ${removed}` }] };
  },
};

export const liveEvaluate: ToolDefinition = {
  name: "cypress_live_evaluate",
  description:
    "Evaluate a JavaScript function in the live page context. Pass a string like `() => document.title` or `(sel) => document.querySelector(sel)?.outerHTML` plus arg.",
  inputSchema: {
    type: "object",
    properties: {
      code: { type: "string", description: "JS function source (will be eval'd)." },
      arg: { description: "Optional argument passed to the function." },
    },
    required: ["code"],
    additionalProperties: true,
  },
  handler: async (args) => {
    const page = await requirePage();
    try {
      // Playwright evaluates string inputs as expressions, so a user-supplied
      // arrow function like `() => document.title` would return the function
      // rather than call it. Wrap as an IIFE with the arg inlined.
      const code = String(args.code);
      const wrapped =
        args.arg !== undefined
          ? `(${code})(${JSON.stringify(args.arg)})`
          : `(${code})()`;
      const result = await page.evaluate(wrapped);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text", text: `evaluate failed: ${msg}` }], isError: true };
    }
  },
};

export const liveGetOuterHtml: ToolDefinition = {
  name: "cypress_live_get_outer_html",
  description:
    "Return the outerHTML for elements matching a selector. Useful before calling cypress_generate_locator.",
  inputSchema: {
    type: "object",
    properties: {
      selector: { type: "string" },
      limit: { type: "number", description: "Default 5." },
    },
    required: ["selector"],
    additionalProperties: false,
  },
  handler: async (args) => {
    const page = await requirePage();
    const limit = (args.limit as number | undefined) ?? 5;
    const items = await page.locator(String(args.selector)).evaluateAll(
      (els, max) =>
        (els as Element[]).slice(0, max as number).map((el) => (el as HTMLElement).outerHTML.slice(0, 2000)),
      limit,
    );
    return { content: [{ type: "text", text: JSON.stringify({ count: items.length, items }, null, 2) }] };
  },
};
