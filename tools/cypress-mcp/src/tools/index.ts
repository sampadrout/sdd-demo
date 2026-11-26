import type { ToolDefinition } from "../types.js";
import { detectProject } from "./detect-project.js";
import { listSpecs } from "./list-specs.js";
import { run } from "./run.js";
import { getFailures } from "./get-failures.js";
import { getScreenshot } from "./get-screenshot.js";
import { newSpec, setCurrent, getCurrent, showSpec } from "./spec-management.js";
import { appendSteps } from "./append-steps.js";
import { runCurrent } from "./run-current.js";
import { storage } from "./storage.js";
import { getVideo, getConsoleMessages, getNetworkRequests } from "./artifacts.js";
import { installHooks } from "./install-hooks.js";
import { generateLocator, generateInterceptFromHar } from "./generate.js";
import { open, close } from "./open.js";
import { getDomSnapshot } from "./get-dom-snapshot.js";
import { suggestSelectorFix } from "./suggest-selector-fix.js";
import { diagnoseFlake } from "./diagnose-flake.js";
import { addCustomCommand } from "./custom-command.js";
import { manageFixture, seedFromApi } from "./fixture.js";
import { installSkills } from "./install-skills.js";
import { liveTools } from "./live/index.js";

export const tools: ToolDefinition[] = [
  // Project discovery + execution
  detectProject,
  listSpecs,
  run,
  runCurrent,
  open,
  close,

  // Spec authoring
  newSpec,
  setCurrent,
  getCurrent,
  showSpec,
  appendSteps,

  // Storage / network code-gen
  storage,

  // Failure & artifact inspection
  getFailures,
  getScreenshot,
  getVideo,
  getConsoleMessages,
  getNetworkRequests,
  installHooks,

  // Generators
  generateLocator,
  generateInterceptFromHar,

  // Healer stack
  getDomSnapshot,
  suggestSelectorFix,
  diagnoseFlake,

  // Generator stack
  addCustomCommand,
  manageFixture,
  seedFromApi,

  // Agent skills
  installSkills,

  // Persistent live-browser mode (Playwright-powered)
  ...liveTools,
];

export const toolMap = new Map(tools.map((t) => [t.name, t]));
