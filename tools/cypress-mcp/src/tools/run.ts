import type { ToolDefinition, RunSummary, SpecRunRecord, TestRecord, TestAttempt } from "../types.js";
import { loadCypress, resolveProjectRoot, getCypressVersion } from "../util/project.js";
import { setLastRun } from "../state.js";

type AnyRec = Record<string, unknown>;

function normalizeAttempt(raw: AnyRec): TestAttempt {
  const err = raw.error as AnyRec | undefined;
  return {
    state: (raw.state as TestAttempt["state"]) ?? "passed",
    duration: (raw.duration as number | undefined) ?? undefined,
    startedAt: (raw.startedAt as string | undefined) ?? undefined,
    videoTimestamp: (raw.videoTimestamp as number | undefined) ?? undefined,
    screenshots: (raw.screenshots as TestAttempt["screenshots"]) ?? [],
    error: err
      ? {
          name: err.name as string | undefined,
          message: (err.message as string) ?? String(err),
          stack: err.stack as string | undefined,
          codeFrame: err.codeFrame,
        }
      : undefined,
  };
}

function normalizeTest(raw: AnyRec): TestRecord {
  const attempts = Array.isArray(raw.attempts) ? (raw.attempts as AnyRec[]).map(normalizeAttempt) : [];
  const title = (raw.title as string[]) ?? [];
  return {
    title,
    fullTitle: title.join(" > "),
    state: (raw.state as TestRecord["state"]) ?? "passed",
    displayError: raw.displayError as string | undefined,
    attempts,
  };
}

function normalizeSpecRun(raw: AnyRec): SpecRunRecord {
  const spec = (raw.spec as AnyRec) ?? {};
  const stats = (raw.stats as AnyRec) ?? {};
  const tests = Array.isArray(raw.tests) ? (raw.tests as AnyRec[]).map(normalizeTest) : [];
  return {
    spec: {
      name: (spec.name as string) ?? "",
      relative: (spec.relative as string) ?? "",
      absolute: (spec.absolute as string) ?? "",
    },
    stats: {
      tests: (stats.tests as number) ?? tests.length,
      passes: (stats.passes as number) ?? 0,
      failures: (stats.failures as number) ?? 0,
      pending: (stats.pending as number) ?? 0,
      skipped: (stats.skipped as number) ?? 0,
      duration: (stats.duration as number) ?? 0,
    },
    video: (raw.video as string | null | undefined) ?? null,
    tests,
  };
}

export const run: ToolDefinition = {
  name: "cypress_run",
  description:
    "Run Cypress tests headlessly using the project's installed Cypress. Returns a structured summary (pass/fail counts, per-spec stats, failing tests with stack traces, screenshot paths). Result is cached so cypress_get_failures and cypress_get_screenshot can reference it.",
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: { type: "string", description: "Project root. Defaults to cwd." },
      spec: {
        type: "string",
        description: "Spec file path or glob (Cypress --spec). Optional; runs all specs by default.",
      },
      browser: {
        type: "string",
        description: "Browser name (e.g. 'chrome', 'electron', 'firefox'). Defaults to Cypress default.",
      },
      testingType: {
        type: "string",
        enum: ["e2e", "component"],
        description: "Testing type. Defaults to 'e2e'.",
      },
      headed: { type: "boolean", description: "Run in headed mode. Defaults to false." },
      configFile: { type: "string", description: "Path to Cypress config file (relative to projectRoot)." },
      env: {
        type: "object",
        description: "Cypress env vars (passed to cy.env()).",
        additionalProperties: true,
      },
      reporter: { type: "string", description: "Override the mocha reporter." },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const projectRoot = resolveProjectRoot(args.projectRoot as string | undefined);
    const cypress = await loadCypress(projectRoot);

    const runOptions: AnyRec = {
      project: projectRoot,
      testingType: (args.testingType as "e2e" | "component" | undefined) ?? "e2e",
      headed: Boolean(args.headed ?? false),
      quiet: true,
    };
    if (args.spec) runOptions.spec = args.spec;
    if (args.browser) runOptions.browser = args.browser;
    if (args.configFile) runOptions.configFile = args.configFile;
    if (args.env) runOptions.env = args.env;
    if (args.reporter) runOptions.reporter = args.reporter;

    // Cypress writes progress/banner text to process.stdout, which corrupts
    // the MCP JSON-RPC stream. Redirect stdout to stderr for the duration of
    // the run so MCP framing stays intact.
    const origStdoutWrite = process.stdout.write.bind(process.stdout);
    const origStderrWrite = process.stderr.write.bind(process.stderr);
    (process.stdout as unknown as { write: typeof origStdoutWrite }).write = ((chunk: unknown, ...rest: unknown[]) =>
      origStderrWrite(chunk as never, ...(rest as []))) as typeof origStdoutWrite;
    let raw: AnyRec;
    try {
      raw = (await cypress.run(runOptions as never)) as unknown as AnyRec;
    } finally {
      (process.stdout as unknown as { write: typeof origStdoutWrite }).write = origStdoutWrite;
    }

    if (raw.status === "failed") {
      const summary: RunSummary = {
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        totalDuration: 0,
        totalTests: 0,
        totalPassed: 0,
        totalFailed: (raw.failures as number) ?? 0,
        totalPending: 0,
        totalSkipped: 0,
        runs: [],
        projectRoot,
        config: args.configFile as string | undefined,
        status: "failed",
        setupError: (raw.message as string) ?? "Cypress setup failed",
      };
      setLastRun(summary);
      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
        isError: true,
      };
    }

    const runs = Array.isArray(raw.runs) ? (raw.runs as AnyRec[]).map(normalizeSpecRun) : [];
    const summary: RunSummary = {
      startedAt: (raw.startedTestsAt as string) ?? new Date().toISOString(),
      endedAt: (raw.endedTestsAt as string) ?? new Date().toISOString(),
      totalDuration: (raw.totalDuration as number) ?? 0,
      totalTests: (raw.totalTests as number) ?? runs.reduce((n, r) => n + r.stats.tests, 0),
      totalPassed: (raw.totalPassed as number) ?? runs.reduce((n, r) => n + r.stats.passes, 0),
      totalFailed: (raw.totalFailed as number) ?? runs.reduce((n, r) => n + r.stats.failures, 0),
      totalPending: (raw.totalPending as number) ?? runs.reduce((n, r) => n + r.stats.pending, 0),
      totalSkipped: (raw.totalSkipped as number) ?? runs.reduce((n, r) => n + r.stats.skipped, 0),
      browserName: raw.browserName as string | undefined,
      browserVersion: raw.browserVersion as string | undefined,
      cypressVersion: (raw.cypressVersion as string) ?? getCypressVersion(projectRoot) ?? undefined,
      runs,
      projectRoot,
      config: args.configFile as string | undefined,
      status: "finished",
    };
    setLastRun(summary);

    // Trim per-attempt stack traces in the headline response; full detail is
    // available via cypress_get_failures.
    const trimmed = {
      ...summary,
      runs: summary.runs.map((r) => ({
        spec: r.spec,
        stats: r.stats,
        video: r.video,
        tests: r.tests.map((t) => ({
          fullTitle: t.fullTitle,
          state: t.state,
          displayError: t.displayError,
        })),
      })),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(trimmed, null, 2) }],
      isError: summary.totalFailed > 0,
    };
  },
};
