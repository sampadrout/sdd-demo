import { existsSync } from "node:fs";
import path from "node:path";
import type { ToolDefinition } from "../types.js";
import { findConfig, getCypressVersion, readPackageJson, resolveProjectRoot } from "../util/project.js";

export const detectProject: ToolDefinition = {
  name: "cypress_detect_project",
  description:
    "Inspect a directory for a Cypress project. Returns Cypress version, config file path, testing type (e2e/component), folder layout, and installed plugins.",
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: {
        type: "string",
        description: "Absolute or relative path to the Cypress project. Defaults to the server's cwd.",
      },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const projectRoot = resolveProjectRoot(args.projectRoot as string | undefined);
    const configPath = findConfig(projectRoot);
    const pkg = readPackageJson(projectRoot);
    const cypressVersion = getCypressVersion(projectRoot);

    const layout = {
      e2eDir: existsSync(path.join(projectRoot, "cypress/e2e")),
      componentDir: existsSync(path.join(projectRoot, "cypress/component")),
      supportDir: existsSync(path.join(projectRoot, "cypress/support")),
      fixturesDir: existsSync(path.join(projectRoot, "cypress/fixtures")),
      screenshotsDir: existsSync(path.join(projectRoot, "cypress/screenshots")),
      videosDir: existsSync(path.join(projectRoot, "cypress/videos")),
    };

    const deps = {
      ...(pkg?.dependencies as Record<string, string> | undefined),
      ...(pkg?.devDependencies as Record<string, string> | undefined),
    };
    const cypressPlugins = Object.keys(deps).filter(
      (name) =>
        name === "cypress-axe" ||
        name === "cypress-real-events" ||
        name.startsWith("@cypress/") ||
        name.startsWith("cypress-") ||
        name === "@testing-library/cypress",
    );

    const summary = {
      projectRoot,
      cypressInstalled: cypressVersion !== null,
      cypressVersion,
      configPath,
      configRelative: configPath ? path.relative(projectRoot, configPath) : null,
      layout,
      cypressPlugins,
      scripts: (pkg?.scripts as Record<string, string> | undefined) ?? {},
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    };
  },
};
