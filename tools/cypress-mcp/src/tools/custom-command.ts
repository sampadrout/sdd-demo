import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition } from "../types.js";
import { resolveProjectRoot } from "../util/project.js";

const DECLARATION_BEGIN = "// --- MCP COMMANDS TYPES BEGIN ---";
const DECLARATION_END = "// --- MCP COMMANDS TYPES END ---";

/**
 * Predefined command templates. Agents (generator) use these by name without
 * needing to hand-author the body. Generic user-supplied bodies are also
 * supported via the `body` + `args` fields.
 */
const TEMPLATES: Record<string, (args: Record<string, unknown>) => { name: string; signature: string; body: string }> = {
  loginAs: (args) => {
    const emailSelector = String(args.emailSelector ?? '[name="email"]');
    const passwordSelector = String(args.passwordSelector ?? '[name="password"]');
    const submitSelector = String(args.submitSelector ?? 'button[type="submit"]');
    const loginUrl = String(args.loginUrl ?? "/login");
    const successAssert = String(args.successAssert ?? "");
    return {
      name: "loginAs",
      signature: "(user: { email: string; password: string })",
      body: `  cy.session(user.email, () => {
    cy.visit(${JSON.stringify(loginUrl)});
    cy.get(${JSON.stringify(emailSelector)}).type(user.email);
    cy.get(${JSON.stringify(passwordSelector)}).type(user.password, { log: false });
    cy.get(${JSON.stringify(submitSelector)}).click();${
      successAssert ? `\n    cy.contains(${JSON.stringify(successAssert)}).should("be.visible");` : ""
    }
  });`,
    };
  },
  seedViaApi: () => ({
    name: "seedViaApi",
    signature: "(endpoint: string, body: unknown)",
    body: `  return cy.request({ method: "POST", url: endpoint, body }).its("body");`,
  }),
  resetDb: (args) => ({
    name: "resetDb",
    signature: "()",
    body: `  return cy.request("POST", ${JSON.stringify(String(args.endpoint ?? "/__test/reset"))});`,
  }),
};

export const addCustomCommand: ToolDefinition = {
  name: "cypress_add_custom_command",
  description:
    "Append a Cypress custom command to cypress/support/commands.{ts,js} and update the Chainable type declaration. Use `template` for prebuilt commands (loginAs, seedViaApi, resetDb) or pass `name`+`body` directly. Idempotent.",
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: { type: "string" },
      template: { type: "string", enum: Object.keys(TEMPLATES) },
      name: { type: "string", description: "Command name (when not using template)." },
      signature: {
        type: "string",
        description: "TypeScript signature like `(user: { email: string; password: string })`. Optional.",
      },
      body: {
        type: "string",
        description: "Function body (without `{}` wrapping). Uses `cy.*` as normal.",
      },
      emailSelector: { type: "string" },
      passwordSelector: { type: "string" },
      submitSelector: { type: "string" },
      loginUrl: { type: "string" },
      successAssert: { type: "string" },
      endpoint: { type: "string" },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const projectRoot = resolveProjectRoot(args.projectRoot as string | undefined);

    let name: string;
    let signature: string;
    let body: string;
    if (args.template) {
      const t = TEMPLATES[args.template as string](args);
      name = t.name;
      signature = t.signature;
      body = t.body;
    } else {
      if (!args.name || !args.body) {
        return {
          content: [{ type: "text", text: "Provide either `template` or `name`+`body`." }],
          isError: true,
        };
      }
      name = String(args.name);
      signature = (args.signature as string | undefined) ?? "()";
      body = String(args.body);
    }

    const language = existsSync(path.join(projectRoot, "tsconfig.json")) ? "ts" : "js";
    const commandsPath = path.join(projectRoot, "cypress", "support", `commands.${language}`);
    await mkdir(path.dirname(commandsPath), { recursive: true });

    const existing = existsSync(commandsPath) ? await readFile(commandsPath, "utf8") : "";
    const marker = `// --- MCP:${name} ---`;
    if (existing.includes(marker)) {
      return { content: [{ type: "text", text: `Command "${name}" already installed at ${commandsPath}.` }] };
    }

    const commandBlock = `${marker}
Cypress.Commands.add("${name}", function ${signature} {
${body}
});
// --- END MCP:${name} ---
`;

    let next = existing + (existing.endsWith("\n") || existing === "" ? "" : "\n") + "\n" + commandBlock;

    if (language === "ts") {
      const declLine = `      ${name}${signature}: Chainable<unknown>;`;
      if (!next.includes(DECLARATION_BEGIN)) {
        next += `
${DECLARATION_BEGIN}
declare global {
  namespace Cypress {
    interface Chainable<Subject = unknown> {
${declLine}
    }
  }
}
export {};
${DECLARATION_END}
`;
      } else if (!next.includes(declLine)) {
        next = next.replace(
          DECLARATION_END,
          `${declLine}\n${DECLARATION_END}`.replace("    interface Chainable", "    interface Chainable"),
        );
        // Insert the new line just above the matching closing brace of the Chainable interface if possible.
        next = next.replace(/(interface Chainable<[^>]+> \{)/, `$1\n${declLine}`);
      }
    }

    await writeFile(commandsPath, next, "utf8");

    // Nudge the user about support/e2e importing commands if it's a brand-new file.
    const supportFile =
      existsSync(path.join(projectRoot, "cypress/support/e2e.ts"))
        ? path.join(projectRoot, "cypress/support/e2e.ts")
        : existsSync(path.join(projectRoot, "cypress/support/e2e.js"))
          ? path.join(projectRoot, "cypress/support/e2e.js")
          : null;
    let supportNote = "";
    if (supportFile) {
      const sup = await readFile(supportFile, "utf8");
      if (!sup.includes("./commands")) {
        const importLine = language === "ts" ? `import "./commands";` : `require("./commands");`;
        await writeFile(supportFile, importLine + "\n" + sup, "utf8");
        supportNote = `\nAdded import of commands to ${supportFile}.`;
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `Added cy.${name}${signature} to ${commandsPath}.${supportNote}`,
        },
      ],
    };
  },
};
