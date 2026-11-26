import path from "node:path";
import type { ToolDefinition } from "../types.js";
import { getSession, setCurrentSpec, setProjectRoot } from "../session.js";
import { appendLines, defaultSpecPath, detectSpecLanguage, ensureSpec, obj, q, type SpecLanguage } from "../util/spec-builder.js";
import { resolveProjectRoot } from "../util/project.js";

type Step = { action: string; [k: string]: unknown };

/**
 * Map of action -> codegen function. Each produces one (or more) lines of
 * Cypress code to append inside an `it()` block.
 *
 * Covers all Playwright MCP capability categories that translate to Cypress:
 * navigation, interaction, input, waiting, assertions, storage, network
 * interception, evaluation, viewport, and screenshots.
 */
const CODEGEN: Record<string, (s: Step) => string[]> = {
  // ---------- Navigation ----------
  visit: (s) => [`cy.visit(${q(String(s.url))}${s.options ? `, ${obj(s.options)}` : ""});`],
  navigate: (s) => [`cy.visit(${q(String(s.url))});`],
  go_back: () => [`cy.go("back");`],
  go_forward: () => [`cy.go("forward");`],
  reload: () => [`cy.reload();`],

  // ---------- Interaction ----------
  click: (s) => {
    const opts: Record<string, unknown> = {};
    if (s.button) opts.button = s.button;
    if (s.force) opts.force = true;
    if (s.modifiers) opts.altKey = undefined; // handled below via .type for modifier keys
    const method = s.doubleClick ? "dblclick" : "click";
    const line = `cy.get(${q(String(s.selector))}).${method}(${Object.keys(opts).length ? obj(opts) : ""});`;
    return [line];
  },
  dblclick: (s) => [`cy.get(${q(String(s.selector))}).dblclick();`],
  rightclick: (s) => [`cy.get(${q(String(s.selector))}).rightclick();`],
  hover: (s) => [`cy.get(${q(String(s.selector))}).trigger("mouseover");`],
  type: (s) => {
    const opts = s.delay !== undefined ? `, ${obj({ delay: s.delay })}` : "";
    const line = `cy.get(${q(String(s.selector))}).type(${q(String(s.text))}${opts});`;
    return s.submit ? [line, `cy.get(${q(String(s.selector))}).type("{enter}");`] : [line];
  },
  clear: (s) => [`cy.get(${q(String(s.selector))}).clear();`],
  select: (s) => [`cy.get(${q(String(s.selector))}).select(${obj(s.values ?? s.value)});`],
  check: (s) => [`cy.get(${q(String(s.selector))}).check(${s.value ? q(String(s.value)) : ""});`],
  uncheck: (s) => [`cy.get(${q(String(s.selector))}).uncheck();`],
  press_key: (s) => {
    const selector = (s.selector as string | undefined) ?? "body";
    return [`cy.get(${q(selector)}).type(${q(`{${s.key}}`)});`];
  },
  upload: (s) => {
    const paths = Array.isArray(s.paths) ? s.paths : [s.path];
    return [`cy.get(${q(String(s.selector))}).selectFile(${obj(paths)});`];
  },
  fill_form: (s) => {
    const fields = (s.fields as Array<{ selector: string; value: string; action?: string }>) ?? [];
    return fields.map((f) => {
      if (f.action === "select") return `cy.get(${q(f.selector)}).select(${q(f.value)});`;
      if (f.action === "check") return `cy.get(${q(f.selector)}).check();`;
      return `cy.get(${q(f.selector)}).clear().type(${q(f.value)});`;
    });
  },
  drag: (s) => [
    `cy.get(${q(String(s.fromSelector))}).trigger("mousedown", { which: 1 });`,
    `cy.get(${q(String(s.toSelector))}).trigger("mousemove").trigger("mouseup", { force: true });`,
  ],
  scroll: (s) => {
    if (s.selector) return [`cy.get(${q(String(s.selector))}).scrollIntoView();`];
    return [`cy.scrollTo(${s.x ?? 0}, ${s.y ?? 0});`];
  },

  // ---------- Waits ----------
  wait: (s) => {
    if (s.ms !== undefined) return [`cy.wait(${Number(s.ms)});`];
    if (s.alias) return [`cy.wait(${q(`@${String(s.alias)}`)});`];
    if (s.text) return [`cy.contains(${q(String(s.text))}).should("be.visible");`];
    if (s.textGone) return [`cy.contains(${q(String(s.textGone))}).should("not.exist");`];
    return [`cy.wait(500);`];
  },
  wait_for: (s) => CODEGEN.wait(s),

  // ---------- Viewport / screenshot ----------
  viewport: (s) => [`cy.viewport(${Number(s.width)}, ${Number(s.height)});`],
  resize: (s) => [`cy.viewport(${Number(s.width)}, ${Number(s.height)});`],
  screenshot: (s) => {
    const name = s.name ? q(String(s.name)) : "";
    const opts = s.options ? `, ${obj(s.options)}` : "";
    if (s.selector) return [`cy.get(${q(String(s.selector))}).screenshot(${name}${opts});`];
    return [`cy.screenshot(${name}${opts});`];
  },

  // ---------- Assertions ----------
  verify_element_visible: (s) => [`cy.get(${q(String(s.selector))}).should("be.visible");`],
  verify_text_visible: (s) => [`cy.contains(${q(String(s.text))}).should("be.visible");`],
  verify_list_visible: (s) => {
    const items = (s.items as string[]) ?? [];
    const base = `cy.get(${q(String(s.selector))})`;
    return [
      `${base}.should("be.visible");`,
      ...items.map((t) => `${base}.contains(${q(t)}).should("be.visible");`),
    ];
  },
  verify_value: (s) => [`cy.get(${q(String(s.selector))}).should("have.value", ${q(String(s.value))});`],
  verify_attr: (s) => [
    `cy.get(${q(String(s.selector))}).should("have.attr", ${q(String(s.name))}, ${q(String(s.value))});`,
  ],
  verify_count: (s) => [`cy.get(${q(String(s.selector))}).should("have.length", ${Number(s.count)});`],
  verify_not_exist: (s) => [`cy.get(${q(String(s.selector))}).should("not.exist");`],
  verify_url: (s) => [`cy.url().should("include", ${q(String(s.url))});`],

  // ---------- Storage (inside spec) ----------
  set_cookie: (s) => [
    `cy.setCookie(${q(String(s.name))}, ${q(String(s.value))}${s.options ? `, ${obj(s.options)}` : ""});`,
  ],
  clear_cookies: () => [`cy.clearCookies();`],
  clear_cookie: (s) => [`cy.clearCookie(${q(String(s.name))});`],
  set_localstorage: (s) => [
    `cy.window().then((win) => win.localStorage.setItem(${q(String(s.key))}, ${q(String(s.value))}));`,
  ],
  clear_localstorage: () => [`cy.clearLocalStorage();`],
  set_sessionstorage: (s) => [
    `cy.window().then((win) => win.sessionStorage.setItem(${q(String(s.key))}, ${q(String(s.value))}));`,
  ],
  clear_sessionstorage: () => [
    `cy.window().then((win) => win.sessionStorage.clear());`,
  ],

  // ---------- Network ----------
  intercept: (s) => {
    const method = s.method ? q(String(s.method)) : undefined;
    const url = q(String(s.url ?? s.pattern));
    const reply: Record<string, unknown> = {};
    if (s.status !== undefined) reply.statusCode = s.status;
    if (s.body !== undefined) reply.body = s.body;
    if (s.fixture) reply.fixture = s.fixture;
    if (s.forceNetworkError) reply.forceNetworkError = true;
    if (s.headers) reply.headers = s.headers;
    const args = method ? [method, url] : [url];
    const call = Object.keys(reply).length ? `cy.intercept(${args.join(", ")}, ${obj(reply)})` : `cy.intercept(${args.join(", ")})`;
    return s.alias ? [`${call}.as(${q(String(s.alias))});`] : [`${call};`];
  },
  wait_for_intercept: (s) => [`cy.wait(${q(`@${String(s.alias)}`)});`],
  network_offline: () => [
    `// Simulate offline: fail all requests until restored.`,
    `cy.intercept("**/*", { forceNetworkError: true });`,
  ],

  // ---------- Dialogs ----------
  handle_dialog: (s) => {
    const event = s.kind === "confirm" ? "window:confirm" : s.kind === "prompt" ? "window:prompt" : "window:alert";
    if (event === "window:confirm") {
      return [`cy.on(${q(event)}, () => ${s.accept === false ? "false" : "true"});`];
    }
    if (event === "window:prompt") {
      return [`cy.window().then((w) => cy.stub(w, "prompt").returns(${q(String(s.text ?? ""))}));`];
    }
    return [`cy.on(${q(event)}, () => {});`];
  },

  // ---------- Evaluate ----------
  evaluate: (s) => {
    const code = String(s.code);
    return [`cy.window().then((win) => { ${code} });`];
  },
  run_code: (s) => [String(s.code)],

  // ---------- Escape hatch ----------
  raw: (s) => [String(s.line)],
};

function codegenSteps(steps: Step[]): string[] {
  const out: string[] = [];
  for (const s of steps) {
    const fn = CODEGEN[s.action];
    if (!fn) {
      out.push(`// [unknown action: ${s.action}]`);
      continue;
    }
    out.push(...fn(s));
  }
  return out;
}

const ACTIONS = Object.keys(CODEGEN);

export const appendSteps: ToolDefinition = {
  name: "cypress_append_steps",
  description: `Append one or more Cypress commands to a spec file. Covers the full Playwright MCP live-automation surface as idiomatic \`cy.*\` code.

Supported actions: ${ACTIONS.join(", ")}.

Example: { "steps": [ { "action": "visit", "url": "https://example.com" }, { "action": "click", "selector": "button[type=submit]" }, { "action": "verify_text_visible", "text": "Welcome" } ] }`,
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: { type: "string" },
      specPath: {
        type: "string",
        description: "Target spec path. Defaults to the session's current spec. Relative paths resolved against projectRoot.",
      },
      createIfMissing: {
        type: "boolean",
        description: "If the spec doesn't exist, create it. Defaults to true.",
      },
      title: {
        type: "string",
        description: "describe() title when creating a new spec.",
      },
      language: { type: "string", enum: ["ts", "js"] },
      steps: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            action: { type: "string", enum: ACTIONS },
          },
          required: ["action"],
          additionalProperties: true,
        },
      },
    },
    required: ["steps"],
    additionalProperties: false,
  },
  handler: async (args) => {
    const session = getSession();
    const projectRoot = args.projectRoot
      ? resolveProjectRoot(args.projectRoot as string)
      : session.projectRoot;
    setProjectRoot(projectRoot);

    const language =
      (args.language as SpecLanguage | undefined) ?? detectSpecLanguage(projectRoot);

    let target = (args.specPath as string | undefined) ?? session.currentSpec ?? null;
    if (target && !path.isAbsolute(target)) target = path.resolve(projectRoot, target);

    if (!target) {
      target = defaultSpecPath(projectRoot, "session", language);
    }

    const createIfMissing = args.createIfMissing !== false;
    if (createIfMissing) {
      await ensureSpec(target, (args.title as string | undefined) ?? path.basename(target), language);
    }

    const steps = args.steps as Step[];
    const lines = codegenSteps(steps);
    await appendLines(target, lines);
    setCurrentSpec(target);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { spec: target, appended: lines.length, lines },
            null,
            2,
          ),
        },
      ],
    };
  },
};
