import type { ToolDefinition } from "../types.js";
import { run } from "./run.js";
import { getSession } from "../session.js";

type AttemptResult = {
  attempt: number;
  totalTests: number;
  passed: number;
  failed: number;
  durationMs: number;
  failedTitles: string[];
};

type TestVerdict = {
  test: string;
  attempts: number;
  passes: number;
  failures: number;
  verdict: "always-fails" | "flaky" | "always-passes";
};

export const diagnoseFlake: ToolDefinition = {
  name: "cypress_diagnose_flake",
  description:
    "Run a spec N times and classify each test as always-fails / flaky / always-passes. The healer agent calls this before attempting selector fixes so it doesn't fight intermittent failures.",
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: { type: "string" },
      spec: { type: "string", description: "Spec path (relative to projectRoot) or glob. Defaults to current spec." },
      attempts: { type: "number", description: "Number of runs. Default 5." },
      browser: { type: "string" },
      testingType: { type: "string", enum: ["e2e", "component"] },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const attempts = (args.attempts as number | undefined) ?? 5;
    const session = getSession();
    const projectRoot = (args.projectRoot as string | undefined) ?? session.projectRoot;
    let spec = args.spec as string | undefined;
    if (!spec) {
      if (!session.currentSpec) {
        return {
          content: [{ type: "text", text: "Provide spec or set a current spec via cypress_new_spec / cypress_set_current_spec." }],
          isError: true,
        };
      }
      spec = session.currentSpec;
    }

    const perTest = new Map<string, { passes: number; failures: number }>();
    const attemptResults: AttemptResult[] = [];

    for (let i = 1; i <= attempts; i++) {
      const started = Date.now();
      const result = await run.handler({
        projectRoot,
        spec,
        browser: args.browser,
        testingType: args.testingType,
      });
      const durationMs = Date.now() - started;
      const raw = result.content[0]?.type === "text" ? result.content[0].text : "{}";
      let summary: Record<string, unknown>;
      try {
        summary = JSON.parse(raw);
      } catch {
        summary = {};
      }
      const runs = (summary.runs as Array<Record<string, unknown>>) ?? [];
      let passed = 0;
      let failed = 0;
      let totalTests = 0;
      const failedTitles: string[] = [];
      for (const r of runs) {
        const tests = (r.tests as Array<Record<string, unknown>>) ?? [];
        for (const t of tests) {
          totalTests++;
          const title = (t.fullTitle as string) ?? "unknown";
          const state = t.state as string;
          const cur = perTest.get(title) ?? { passes: 0, failures: 0 };
          if (state === "failed") {
            failed++;
            cur.failures++;
            failedTitles.push(title);
          } else if (state === "passed") {
            passed++;
            cur.passes++;
          }
          perTest.set(title, cur);
        }
      }
      attemptResults.push({ attempt: i, totalTests, passed, failed, durationMs, failedTitles });
    }

    const verdicts: TestVerdict[] = [];
    for (const [test, v] of perTest.entries()) {
      const total = v.passes + v.failures;
      let verdict: TestVerdict["verdict"];
      if (v.failures === 0) verdict = "always-passes";
      else if (v.passes === 0) verdict = "always-fails";
      else verdict = "flaky";
      verdicts.push({ test, attempts: total, passes: v.passes, failures: v.failures, verdict });
    }

    const totals = {
      attemptsRun: attempts,
      alwaysPasses: verdicts.filter((v) => v.verdict === "always-passes").length,
      alwaysFails: verdicts.filter((v) => v.verdict === "always-fails").length,
      flaky: verdicts.filter((v) => v.verdict === "flaky").length,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              spec,
              totals,
              attempts: attemptResults,
              verdicts: verdicts.sort((a, b) => {
                const rank = (v: TestVerdict) =>
                  v.verdict === "always-fails" ? 0 : v.verdict === "flaky" ? 1 : 2;
                return rank(a) - rank(b);
              }),
            },
            null,
            2,
          ),
        },
      ],
      isError: totals.alwaysFails > 0 || totals.flaky > 0,
    };
  },
};
