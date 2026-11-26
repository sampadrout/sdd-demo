import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Default project when a tool is called without `projectRoot`.
 * Set MCP_CYPRESS_PROJECT_ROOT to the Cypress app folder (for example apps/parabank).
 * Falls back to the current working directory.
 */
export function defaultProjectRoot(): string {
  return process.env.MCP_CYPRESS_PROJECT_ROOT
    ? path.resolve(process.env.MCP_CYPRESS_PROJECT_ROOT)
    : process.cwd();
}

export function resolveProjectRoot(input?: string): string {
  if (!input) return defaultProjectRoot();
  return path.isAbsolute(input) ? input : path.resolve(process.cwd(), input);
}

export function findConfig(projectRoot: string): string | null {
  const candidates = [
    "cypress.config.ts",
    "cypress.config.js",
    "cypress.config.mjs",
    "cypress.config.cjs",
    "cypress.json",
  ];
  for (const c of candidates) {
    const p = path.join(projectRoot, c);
    if (existsSync(p)) return p;
  }
  return null;
}

export function readPackageJson(projectRoot: string): Record<string, unknown> | null {
  const p = path.join(projectRoot, "package.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Resolve the Cypress package installed in the user's project, not the one
 * bundled with this MCP server. This ensures we drive the exact version the
 * user's tests were written against.
 */
export async function loadCypress(projectRoot: string): Promise<typeof import("cypress")> {
  const require = createRequire(path.join(projectRoot, "package.json"));
  let resolved: string;
  try {
    resolved = require.resolve("cypress");
  } catch {
    throw new Error(
      `Cypress is not installed in ${projectRoot}. Run \`npm install --save-dev cypress\` in that directory first.`,
    );
  }
  const mod = await import(resolved);
  return (mod.default ?? mod) as typeof import("cypress");
}

export function getCypressVersion(projectRoot: string): string | null {
  const require = createRequire(path.join(projectRoot, "package.json"));
  try {
    const pkgPath = require.resolve("cypress/package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    return typeof pkg.version === "string" ? pkg.version : null;
  } catch {
    return null;
  }
}
