import type { ToolDefinition } from "../../types.js";
import { requirePage } from "../../browser/manager.js";
import { appendSteps } from "../append-steps.js";

/**
 * All interact tools share an `appendToSpec` flag. When true, the live action
 * is mirrored as a `cy.*` line appended to the session's current spec, so the
 * agent can turn live exploration into a replayable Cypress test.
 */

async function maybeAppend(append: boolean | undefined, steps: Array<Record<string, unknown>>): Promise<void> {
  if (!append) return;
  await appendSteps.handler({ steps });
}

export const liveClick: ToolDefinition = {
  name: "cypress_live_click",
  description: "Click an element in the live browser. Set appendToSpec:true to record `cy.get(sel).click()` in the current spec.",
  inputSchema: {
    type: "object",
    properties: {
      selector: { type: "string", description: "CSS or Playwright selector (e.g. 'role=button[name=\"Sign in\"]')." },
      button: { type: "string", enum: ["left", "right", "middle"] },
      doubleClick: { type: "boolean" },
      force: { type: "boolean" },
      appendToSpec: { type: "boolean" },
      cypressSelector: {
        type: "string",
        description: "Override the selector used in the appended cy.get(). Defaults to `selector`.",
      },
    },
    required: ["selector"],
    additionalProperties: false,
  },
  handler: async (args) => {
    const page = await requirePage();
    const selector = String(args.selector);
    const locator = page.locator(selector);
    const opts: Record<string, unknown> = {};
    if (args.button) opts.button = args.button;
    if (args.force) opts.force = true;
    if (args.doubleClick) await locator.dblclick(opts);
    else await locator.click(opts);

    const cySel = (args.cypressSelector as string | undefined) ?? selector;
    await maybeAppend(args.appendToSpec as boolean, [
      { action: args.doubleClick ? "dblclick" : "click", selector: cySel, button: args.button, force: args.force },
    ]);

    return { content: [{ type: "text", text: `clicked ${selector}` }] };
  },
};

export const liveType: ToolDefinition = {
  name: "cypress_live_type",
  description: "Type into an element in the live browser.",
  inputSchema: {
    type: "object",
    properties: {
      selector: { type: "string" },
      text: { type: "string" },
      clear: { type: "boolean", description: "Clear the field before typing." },
      submit: { type: "boolean", description: "Press Enter after typing." },
      delay: { type: "number", description: "Delay between keystrokes in ms." },
      appendToSpec: { type: "boolean" },
      cypressSelector: { type: "string" },
    },
    required: ["selector", "text"],
    additionalProperties: false,
  },
  handler: async (args) => {
    const page = await requirePage();
    const selector = String(args.selector);
    const text = String(args.text);
    const locator = page.locator(selector);
    if (args.clear) await locator.fill("");
    await locator.type(text, { delay: args.delay as number | undefined });
    if (args.submit) await locator.press("Enter");
    const cySel = (args.cypressSelector as string | undefined) ?? selector;
    await maybeAppend(args.appendToSpec as boolean, [
      ...(args.clear ? [{ action: "clear", selector: cySel }] : []),
      { action: "type", selector: cySel, text, submit: args.submit, delay: args.delay },
    ]);
    return { content: [{ type: "text", text: `typed ${text.length} chars into ${selector}` }] };
  },
};

export const liveHover: ToolDefinition = {
  name: "cypress_live_hover",
  description: "Hover over an element.",
  inputSchema: {
    type: "object",
    properties: {
      selector: { type: "string" },
      appendToSpec: { type: "boolean" },
      cypressSelector: { type: "string" },
    },
    required: ["selector"],
    additionalProperties: false,
  },
  handler: async (args) => {
    const page = await requirePage();
    const selector = String(args.selector);
    await page.locator(selector).hover();
    const cySel = (args.cypressSelector as string | undefined) ?? selector;
    await maybeAppend(args.appendToSpec as boolean, [{ action: "hover", selector: cySel }]);
    return { content: [{ type: "text", text: `hovered ${selector}` }] };
  },
};

export const livePressKey: ToolDefinition = {
  name: "cypress_live_press_key",
  description: "Press a keyboard key (e.g. Enter, Escape, Control+A).",
  inputSchema: {
    type: "object",
    properties: {
      key: { type: "string" },
      selector: { type: "string", description: "If set, press while focused on this element." },
      appendToSpec: { type: "boolean" },
      cypressSelector: { type: "string" },
    },
    required: ["key"],
    additionalProperties: false,
  },
  handler: async (args) => {
    const page = await requirePage();
    const key = String(args.key);
    if (args.selector) {
      await page.locator(String(args.selector)).press(key);
    } else {
      await page.keyboard.press(key);
    }
    const cySel = (args.cypressSelector as string | undefined) ?? (args.selector as string | undefined);
    await maybeAppend(args.appendToSpec as boolean, [
      { action: "press_key", key, selector: cySel },
    ]);
    return { content: [{ type: "text", text: `pressed ${key}` }] };
  },
};

export const liveFill: ToolDefinition = {
  name: "cypress_live_fill",
  description: "Fill a form field (clears first, then sets value). Lower-level than cypress_live_type.",
  inputSchema: {
    type: "object",
    properties: {
      selector: { type: "string" },
      value: { type: "string" },
      appendToSpec: { type: "boolean" },
      cypressSelector: { type: "string" },
    },
    required: ["selector", "value"],
    additionalProperties: false,
  },
  handler: async (args) => {
    const page = await requirePage();
    const selector = String(args.selector);
    const value = String(args.value);
    await page.locator(selector).fill(value);
    const cySel = (args.cypressSelector as string | undefined) ?? selector;
    await maybeAppend(args.appendToSpec as boolean, [
      { action: "clear", selector: cySel },
      { action: "type", selector: cySel, text: value },
    ]);
    return { content: [{ type: "text", text: `filled ${selector}` }] };
  },
};

export const liveSelect: ToolDefinition = {
  name: "cypress_live_select",
  description: "Select one or more options in a <select> element.",
  inputSchema: {
    type: "object",
    properties: {
      selector: { type: "string" },
      values: { type: "array", items: { type: "string" } },
      appendToSpec: { type: "boolean" },
      cypressSelector: { type: "string" },
    },
    required: ["selector", "values"],
    additionalProperties: false,
  },
  handler: async (args) => {
    const page = await requirePage();
    const selector = String(args.selector);
    const values = args.values as string[];
    await page.locator(selector).selectOption(values);
    const cySel = (args.cypressSelector as string | undefined) ?? selector;
    await maybeAppend(args.appendToSpec as boolean, [
      { action: "select", selector: cySel, values },
    ]);
    return { content: [{ type: "text", text: `selected ${values.join(",")} in ${selector}` }] };
  },
};
