#!/usr/bin/env node
/**
 * First-time setup for a fresh clone. Same command on macOS and Windows:
 *
 *   npm run setup
 *
 * Requires Node.js 22, 24, or 26+ (Cypress 16 dropped Node 20 and 25; npm comes with it). Everything else is installed here:
 * repo dependencies, the Cypress binary, the Cypress MCP server, Playwright
 * Chromium, and a refresh of the OpenSpec agent skills.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const TOTAL = 6;

function step(n, title) {
  console.log(`\n[${n}/${TOTAL}] ${title}`);
}

function run(command, args) {
  const pretty = [command, ...args].join(" ");
  console.log(`> ${pretty}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: isWin,
    env: process.env,
  });
  if (result.error) {
    console.error(`\nCould not start "${command}": ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`\nSetup stopped. "${pretty}" exited with code ${result.status}.`);
    process.exit(result.status ?? 1);
  }
}

function requireSupportedNode() {
  step(1, "Check Node.js");
  const major = Number(process.versions.node.split(".")[0]);
  // Cypress 16 supports Node 22.x, 24.x and >=26.x (Node 20 and 25 were removed).
  const supported = major === 22 || major === 24 || major >= 26;
  if (!Number.isFinite(major) || !supported) {
    console.error(`Node.js 22, 24, or 26+ is required (Cypress 16). This machine has ${process.version}.`);
    console.error("Install it from https://nodejs.org/ (the LTS installer includes npm), then run: npm run setup");
    process.exit(1);
  }
  console.log(`Node ${process.version} on ${process.platform}.`);
}

function installRepo() {
  step(2, "Install repo dependencies (npm ci)");
  if (!existsSync(path.join(root, "package-lock.json"))) {
    console.error("package-lock.json is missing. Clone the full repo, then run npm run setup again.");
    process.exit(1);
  }
  run("npm", ["ci"]);
}

function installCypress() {
  step(3, "Install and verify the Cypress binary");
  run("npx", ["cypress", "install"]);
  run("npx", ["cypress", "verify"]);
}

function installMcp() {
  step(4, "Build the Cypress MCP server and install Playwright Chromium");
  run("npm", ["run", "mcp:setup"]);
}

function refreshOpenSpec() {
  step(5, "Refresh OpenSpec agent skills");
  run("npx", ["openspec", "update"]);
}

function ensureEnv() {
  step(6, "Local env file");
  const envFile = path.join(root, ".env");
  const example = path.join(root, ".env.example");
  if (existsSync(envFile)) {
    console.log(".env already exists. Left it unchanged.");
    return;
  }
  if (!existsSync(example)) {
    console.log("No .env.example found. Skipping.");
    return;
  }
  copyFileSync(example, envFile);
  console.log("Created .env from .env.example. Add your own keys there if a feature needs them.");
}

function done() {
  console.log(`
Setup complete.

Next:
  1. Reload Cursor (or its MCP servers) so the Cypress MCP starts from tools/cypress-mcp/dist/server.js.
  2. In Cursor, sign in to the Atlassian MCP if you use /from-jira. This script does not do that login.
  3. Install Google Chrome if it is not already installed. npm run cy:run and npm run cy:open use Chrome.
  4. Run the sample journey:  npm run cy:run
`);
}

requireSupportedNode();
installRepo();
installCypress();
installMcp();
refreshOpenSpec();
ensureEnv();
done();
