import fg from "fast-glob";
import path from "node:path";
import type { ToolDefinition } from "../types.js";
import { resolveProjectRoot } from "../util/project.js";

const DEFAULT_E2E_PATTERNS = ["cypress/e2e/**/*.cy.{js,jsx,ts,tsx}"];
const DEFAULT_COMPONENT_PATTERNS = [
  "src/**/*.cy.{js,jsx,ts,tsx}",
  "cypress/component/**/*.cy.{js,jsx,ts,tsx}",
];

export const listSpecs: ToolDefinition = {
  name: "cypress_list_specs",
  description:
    "List Cypress spec files for a project. Supports custom glob patterns; defaults to standard e2e and component conventions.",
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: { type: "string", description: "Project root. Defaults to cwd." },
      testingType: {
        type: "string",
        enum: ["e2e", "component", "all"],
        description: "Which specs to enumerate. Defaults to 'all'.",
      },
      patterns: {
        type: "array",
        items: { type: "string" },
        description: "Override glob patterns (relative to projectRoot).",
      },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const projectRoot = resolveProjectRoot(args.projectRoot as string | undefined);
    const testingType = (args.testingType as string | undefined) ?? "all";
    const overrides = args.patterns as string[] | undefined;

    let patterns: string[];
    if (overrides && overrides.length > 0) {
      patterns = overrides;
    } else if (testingType === "e2e") {
      patterns = DEFAULT_E2E_PATTERNS;
    } else if (testingType === "component") {
      patterns = DEFAULT_COMPONENT_PATTERNS;
    } else {
      patterns = [...DEFAULT_E2E_PATTERNS, ...DEFAULT_COMPONENT_PATTERNS];
    }

    const matches = await fg(patterns, {
      cwd: projectRoot,
      absolute: false,
      onlyFiles: true,
      ignore: ["**/node_modules/**", "**/dist/**", "**/build/**"],
    });

    const specs = matches.map((rel) => ({
      relative: rel,
      absolute: path.join(projectRoot, rel),
      kind: rel.includes("/component/") || !rel.startsWith("cypress/") ? "component" : "e2e",
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ projectRoot, patterns, count: specs.length, specs }, null, 2),
        },
      ],
    };
  },
};
