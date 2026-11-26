import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition } from "../types.js";
import { resolveProjectRoot } from "../util/project.js";

/**
 * Given an HTML fragment + human description, propose the strongest selector
 * using Cypress/Testing-Library conventions. Deterministic heuristic — no
 * DOM runtime; the agent supplies the element.
 */
export const generateLocator: ToolDefinition = {
  name: "cypress_generate_locator",
  description:
    "Suggest a stable Cypress selector for an element. Provide the element's outerHTML (required) and optionally a human-readable description. Priority: data-cy > data-testid > data-test > id > role+name > tag+text > CSS path.",
  inputSchema: {
    type: "object",
    properties: {
      html: { type: "string", description: "outerHTML of the element." },
      description: { type: "string", description: "Human description (for role-based selector fallback)." },
    },
    required: ["html"],
    additionalProperties: false,
  },
  handler: async (args) => {
    const html = String(args.html).trim();
    const description = (args.description as string | undefined) ?? "";

    const attr = (name: string): string | null => {
      const m = html.match(new RegExp(`${name}=(?:\"([^\"]+)\"|'([^']+)')`));
      return m ? m[1] ?? m[2] ?? null : null;
    };

    const dataCy = attr("data-cy");
    const dataTestid = attr("data-testid");
    const dataTest = attr("data-test");
    const id = attr("id");
    const name = attr("name");
    const ariaLabel = attr("aria-label");
    const type = attr("type");
    const role = attr("role");
    const tagMatch = html.match(/^<\s*([a-zA-Z][a-zA-Z0-9-]*)/);
    const tag = tagMatch ? tagMatch[1].toLowerCase() : null;
    const textMatch = html.match(/>([^<]+)</);
    const text = textMatch ? textMatch[1].trim() : null;

    const suggestions: Array<{ rank: number; cypress: string; rationale: string }> = [];

    if (dataCy) suggestions.push({ rank: 1, cypress: `cy.get('[data-cy="${dataCy}"]')`, rationale: "data-cy (Cypress convention)" });
    if (dataTestid) suggestions.push({ rank: 2, cypress: `cy.get('[data-testid="${dataTestid}"]')`, rationale: "data-testid (testing-library)" });
    if (dataTest) suggestions.push({ rank: 2, cypress: `cy.get('[data-test="${dataTest}"]')`, rationale: "data-test" });
    if (id) suggestions.push({ rank: 3, cypress: `cy.get('#${id}')`, rationale: "id (fragile if dynamic)" });
    if (ariaLabel) suggestions.push({ rank: 4, cypress: `cy.get('[aria-label="${ariaLabel}"]')`, rationale: "aria-label (accessible)" });
    if (tag === "input" && name) suggestions.push({ rank: 5, cypress: `cy.get('input[name="${name}"]')`, rationale: "input name" });
    if (tag === "button" && text) suggestions.push({ rank: 5, cypress: `cy.contains('button', ${JSON.stringify(text)})`, rationale: "button text" });
    if (role && description) suggestions.push({ rank: 6, cypress: `cy.findByRole(${JSON.stringify(role)}, { name: ${JSON.stringify(description)} })`, rationale: "@testing-library/cypress findByRole" });
    if (tag === "a" && text) suggestions.push({ rank: 6, cypress: `cy.contains('a', ${JSON.stringify(text)})`, rationale: "link text" });
    if (tag && type) suggestions.push({ rank: 7, cypress: `cy.get('${tag}[type="${type}"]')`, rationale: "tag + type" });

    suggestions.sort((a, b) => a.rank - b.rank);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              best: suggestions[0]?.cypress ?? `cy.get(${JSON.stringify(tag ?? "*")})`,
              suggestions,
              parsed: { tag, id, dataCy, dataTestid, role, ariaLabel, name, type, text },
            },
            null,
            2,
          ),
        },
      ],
    };
  },
};

type HarEntry = {
  request: { method: string; url: string };
  response: { status: number; content?: { text?: string; mimeType?: string }; headers?: Array<{ name: string; value: string }> };
};

export const generateInterceptFromHar: ToolDefinition = {
  name: "cypress_generate_intercept_from_har",
  description:
    "Convert a HAR file into a list of cy.intercept() statements (one per unique method+URL). Optionally writes them into the current/target spec.",
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: { type: "string" },
      harPath: { type: "string", description: "Path to HAR file (absolute or relative to projectRoot)." },
      urlFilter: { type: "string", description: "Only include entries whose URL contains this substring." },
      useFixtures: {
        type: "boolean",
        description: "If true, write response bodies to cypress/fixtures/ and reference them via { fixture }. Defaults to false (inlined body).",
      },
      writeToSpec: { type: "boolean", description: "If true, append intercepts to the current spec." },
    },
    required: ["harPath"],
    additionalProperties: false,
  },
  handler: async (args) => {
    const projectRoot = resolveProjectRoot(args.projectRoot as string | undefined);
    const harPath = path.isAbsolute(args.harPath as string)
      ? (args.harPath as string)
      : path.join(projectRoot, args.harPath as string);
    const raw = await readFile(harPath, "utf8");
    const har = JSON.parse(raw) as { log: { entries: HarEntry[] } };
    const needle = (args.urlFilter as string | undefined)?.toLowerCase();

    const seen = new Set<string>();
    const intercepts: string[] = [];
    for (const e of har.log.entries) {
      const key = `${e.request.method} ${e.request.url}`;
      if (seen.has(key)) continue;
      if (needle && !e.request.url.toLowerCase().includes(needle)) continue;
      seen.add(key);

      const reply: Record<string, unknown> = { statusCode: e.response.status };
      if (e.response.content?.text) {
        try {
          reply.body = JSON.parse(e.response.content.text);
        } catch {
          reply.body = e.response.content.text;
        }
      }
      intercepts.push(
        `cy.intercept(${JSON.stringify(e.request.method)}, ${JSON.stringify(e.request.url)}, ${JSON.stringify(reply)});`,
      );
    }

    const result = {
      source: harPath,
      generated: intercepts.length,
      intercepts,
    };

    if (args.writeToSpec) {
      const { appendSteps } = await import("./append-steps.js");
      await appendSteps.handler({
        steps: intercepts.map((line) => ({ action: "raw", line })),
      });
    }

    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
};
