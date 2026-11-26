import type { RunSummary } from "./types.js";

let lastRun: RunSummary | null = null;

export function setLastRun(summary: RunSummary): void {
  lastRun = summary;
}

export function getLastRun(): RunSummary | null {
  return lastRun;
}

export function clearLastRun(): void {
  lastRun = null;
}
