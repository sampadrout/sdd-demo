import type { ToolDefinition } from "../types.js";
import { appendSteps } from "./append-steps.js";

/**
 * Maps Playwright MCP's 17 storage tools (cookies × 5, localStorage × 5,
 * sessionStorage × 5, storage_state × 2) onto one dispatcher that emits the
 * appropriate `cy.*` command via cypress_append_steps.
 */
const ACTIONS = [
  "cookie_set",
  "cookie_delete",
  "cookie_clear",
  "cookie_get",
  "cookie_list",
  "localstorage_set",
  "localstorage_delete",
  "localstorage_clear",
  "localstorage_get",
  "localstorage_list",
  "sessionstorage_set",
  "sessionstorage_delete",
  "sessionstorage_clear",
  "sessionstorage_get",
  "sessionstorage_list",
  "save_storage_state",
  "restore_storage_state",
] as const;

type Action = (typeof ACTIONS)[number];

function toStep(action: Action, args: Record<string, unknown>): Array<Record<string, unknown>> {
  switch (action) {
    case "cookie_set":
      return [{ action: "set_cookie", name: args.name, value: args.value, options: args.options }];
    case "cookie_delete":
      return [{ action: "raw", line: `cy.clearCookie(${JSON.stringify(String(args.name))});` }];
    case "cookie_clear":
      return [{ action: "clear_cookies" }];
    case "cookie_get":
      return [{ action: "raw", line: `cy.getCookie(${JSON.stringify(String(args.name))}).then((c) => cy.log(JSON.stringify(c)));` }];
    case "cookie_list":
      return [{ action: "raw", line: `cy.getCookies().then((cs) => cy.log(JSON.stringify(cs)));` }];
    case "localstorage_set":
      return [{ action: "set_localstorage", key: args.key, value: args.value }];
    case "localstorage_delete":
      return [{ action: "raw", line: `cy.window().then((w) => w.localStorage.removeItem(${JSON.stringify(String(args.key))}));` }];
    case "localstorage_clear":
      return [{ action: "clear_localstorage" }];
    case "localstorage_get":
      return [{ action: "raw", line: `cy.window().then((w) => cy.log(w.localStorage.getItem(${JSON.stringify(String(args.key))}) ?? "null"));` }];
    case "localstorage_list":
      return [{ action: "raw", line: `cy.window().then((w) => cy.log(JSON.stringify({ ...w.localStorage })));` }];
    case "sessionstorage_set":
      return [{ action: "set_sessionstorage", key: args.key, value: args.value }];
    case "sessionstorage_delete":
      return [{ action: "raw", line: `cy.window().then((w) => w.sessionStorage.removeItem(${JSON.stringify(String(args.key))}));` }];
    case "sessionstorage_clear":
      return [{ action: "clear_sessionstorage" }];
    case "sessionstorage_get":
      return [{ action: "raw", line: `cy.window().then((w) => cy.log(w.sessionStorage.getItem(${JSON.stringify(String(args.key))}) ?? "null"));` }];
    case "sessionstorage_list":
      return [{ action: "raw", line: `cy.window().then((w) => cy.log(JSON.stringify({ ...w.sessionStorage })));` }];
    case "save_storage_state":
      // Cypress has cy.session(); closest analog is writing cookies+localStorage to a fixture.
      return [
        {
          action: "raw",
          line: `cy.getCookies().then((cookies) => cy.window().then((w) => cy.writeFile(${JSON.stringify(String(args.filename ?? "cypress/fixtures/storage-state.json"))}, { cookies, localStorage: { ...w.localStorage } })));`,
        },
      ];
    case "restore_storage_state":
      return [
        {
          action: "raw",
          line: `cy.readFile(${JSON.stringify(String(args.filename))}).then((s) => { (s.cookies ?? []).forEach((c) => cy.setCookie(c.name, c.value, c)); cy.window().then((w) => Object.entries(s.localStorage ?? {}).forEach(([k, v]) => w.localStorage.setItem(k, v))); });`,
        },
      ];
  }
}

export const storage: ToolDefinition = {
  name: "cypress_storage",
  description:
    "Emit Cypress code for cookies, localStorage, sessionStorage, and storage-state save/restore. One dispatcher tool covering Playwright MCP's 17 storage tools.",
  inputSchema: {
    type: "object",
    properties: {
      action: { type: "string", enum: [...ACTIONS] },
      name: { type: "string" },
      value: { type: "string" },
      key: { type: "string" },
      filename: { type: "string" },
      options: { type: "object", additionalProperties: true },
      specPath: { type: "string" },
    },
    required: ["action"],
    additionalProperties: false,
  },
  handler: async (args) => {
    const action = args.action as Action;
    const steps = toStep(action, args);
    return appendSteps.handler({ steps, specPath: args.specPath });
  },
};
