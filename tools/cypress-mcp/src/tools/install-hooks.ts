import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition } from "../types.js";
import { resolveProjectRoot } from "../util/project.js";

const SUPPORT_HOOK = `// --- BEGIN MCP HOOKS ---
// Auto-installed by cypress-mcp. Captures console + network to cypress/logs/,
// and the DOM at the moment a test fails (so the healer agent can self-repair
// selectors against the actual state at failure time).
const MCP_SPEC = () => (Cypress.spec && Cypress.spec.relative) || "unknown";
const MCP_SLUG = (s) => String(s || "").replace(/[^\\w.-]+/g, "-").slice(0, 120);

beforeEach(() => {
  cy.window({ log: false }).then((win) => {
    const levels = ["log", "info", "warn", "error", "debug"];
    levels.forEach((lvl) => {
      const orig = win.console[lvl];
      win.console[lvl] = (...args) => {
        try {
          cy.task("mcp:console", {
            level: lvl,
            args: args.map((a) => {
              try { return typeof a === "string" ? a : JSON.stringify(a); } catch { return String(a); }
            }),
            ts: Date.now(),
            spec: MCP_SPEC(),
          }, { log: false });
        } catch (_e) { /* ignore */ }
        orig.apply(win.console, args);
      };
    });
  });
  cy.intercept({ resourceType: /.*/ }, (req) => {
    const started = Date.now();
    req.on("response", (res) => {
      try {
        cy.task("mcp:network", {
          url: req.url,
          method: req.method,
          status: res.statusCode,
          duration: Date.now() - started,
          ts: started,
          spec: MCP_SPEC(),
        }, { log: false });
      } catch (_e) { /* ignore */ }
    });
  });
});

afterEach(function () {
  try {
    if (this.currentTest && this.currentTest.state === "failed") {
      const doc = cy.state("document") || window.document;
      const html = doc && doc.documentElement ? doc.documentElement.outerHTML : "(no document)";
      const url = doc && doc.location ? doc.location.href : "";
      const spec = MCP_SPEC();
      const title = this.currentTest.fullTitle ? this.currentTest.fullTitle() : this.currentTest.title;
      cy.task("mcp:dom-snapshot", {
        spec,
        test: title,
        slug: MCP_SLUG(spec) + "__" + MCP_SLUG(title),
        url,
        html,
        error: (this.currentTest.err && this.currentTest.err.message) || "",
        ts: Date.now(),
      }, { log: false });
    }
  } catch (_e) { /* ignore */ }
});
// --- END MCP HOOKS ---
`;

const PLUGIN_HOOK = `  // --- BEGIN MCP HOOKS ---
  const fs = require("node:fs");
  const path = require("node:path");
  const logsDir = path.join(config.projectRoot, "cypress", "logs");
  const domDir = path.join(logsDir, "dom-snapshots");
  fs.mkdirSync(logsDir, { recursive: true });
  fs.mkdirSync(domDir, { recursive: true });
  on("task", {
    "mcp:console": (entry) => {
      fs.appendFileSync(path.join(logsDir, "console.json"), JSON.stringify(entry) + "\\n");
      return null;
    },
    "mcp:network": (entry) => {
      fs.appendFileSync(path.join(logsDir, "network.json"), JSON.stringify(entry) + "\\n");
      return null;
    },
    "mcp:dom-snapshot": (entry) => {
      const htmlPath = path.join(domDir, entry.slug + ".html");
      const metaPath = path.join(domDir, entry.slug + ".json");
      fs.writeFileSync(htmlPath, entry.html);
      fs.writeFileSync(metaPath, JSON.stringify({
        spec: entry.spec, test: entry.test, url: entry.url,
        error: entry.error, ts: entry.ts, htmlPath
      }, null, 2));
      fs.appendFileSync(path.join(logsDir, "dom-snapshots.json"),
        JSON.stringify({ slug: entry.slug, spec: entry.spec, test: entry.test, error: entry.error, ts: entry.ts, htmlPath, metaPath }) + "\\n");
      return null;
    },
  });
  // --- END MCP HOOKS ---
`;

export const installHooks: ToolDefinition = {
  name: "cypress_install_log_hooks",
  description:
    "Install support-file hooks that capture browser console messages, network requests, and DOM-at-failure into cypress/logs/. Unlocks cypress_get_console_messages, cypress_get_network_requests, cypress_get_dom_snapshot, and cypress_suggest_selector_fix. Idempotent.",
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: { type: "string" },
      supportFile: {
        type: "string",
        description: "Path to support file. Defaults to cypress/support/e2e.{ts,js}.",
      },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const projectRoot = resolveProjectRoot(args.projectRoot as string | undefined);
    const notes: string[] = [];

    // 1. Support file
    let supportFile = args.supportFile as string | undefined;
    if (!supportFile) {
      const candidates = [
        "cypress/support/e2e.ts",
        "cypress/support/e2e.js",
        "cypress/support/index.ts",
        "cypress/support/index.js",
      ];
      for (const c of candidates) {
        if (existsSync(path.join(projectRoot, c))) {
          supportFile = c;
          break;
        }
      }
      if (!supportFile) supportFile = "cypress/support/e2e.ts";
    }
    const supportAbs = path.isAbsolute(supportFile) ? supportFile : path.join(projectRoot, supportFile);
    await mkdir(path.dirname(supportAbs), { recursive: true });
    const existing = existsSync(supportAbs) ? await readFile(supportAbs, "utf8") : "";
    if (existing.includes("--- BEGIN MCP HOOKS ---")) {
      notes.push(`support hook already present in ${supportAbs}`);
    } else {
      await writeFile(supportAbs, existing + (existing.endsWith("\n") ? "" : "\n") + SUPPORT_HOOK, "utf8");
      notes.push(`support hook written to ${supportAbs}`);
    }

    // 2. Config file (to register the task handler)
    const configCandidates = ["cypress.config.ts", "cypress.config.js", "cypress.config.mjs"];
    let configAbs: string | null = null;
    for (const c of configCandidates) {
      if (existsSync(path.join(projectRoot, c))) {
        configAbs = path.join(projectRoot, c);
        break;
      }
    }
    if (!configAbs) {
      notes.push(
        `no cypress.config.* found; please add the task handler shown below to your e2e.setupNodeEvents:\n\n${PLUGIN_HOOK}`,
      );
    } else {
      const conf = await readFile(configAbs, "utf8");
      if (conf.includes("--- BEGIN MCP HOOKS ---")) {
        notes.push(`config hook already present in ${configAbs}`);
      } else {
        // Inject inside setupNodeEvents body. If not found, just append a comment.
        const setupMatch = conf.match(/setupNodeEvents\s*\(\s*on\s*,\s*config\s*\)\s*\{/);
        if (setupMatch && setupMatch.index !== undefined) {
          const insertAt = setupMatch.index + setupMatch[0].length;
          const next = conf.slice(0, insertAt) + "\n" + PLUGIN_HOOK + conf.slice(insertAt);
          await writeFile(configAbs, next, "utf8");
          notes.push(`config hook injected into setupNodeEvents in ${configAbs}`);
        } else {
          notes.push(
            `could not find setupNodeEvents(on, config) in ${configAbs}; please add this snippet manually:\n\n${PLUGIN_HOOK}`,
          );
        }
      }
    }

    return { content: [{ type: "text", text: notes.join("\n") }] };
  },
};
