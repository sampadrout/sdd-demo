import type { ToolDefinition } from "../types.js";
import { getLastRun } from "../state.js";

export const getFailures: ToolDefinition = {
  name: "cypress_get_failures",
  description:
    "Return detailed failure information from the most recent cypress_run: failing test titles, error name/message/stack, code frame, screenshot paths, and final-attempt data. Call cypress_run first.",
  inputSchema: {
    type: "object",
    properties: {
      specFilter: {
        type: "string",
        description: "Substring match against spec relative path to filter results.",
      },
      includeStack: {
        type: "boolean",
        description: "Include full stack traces. Defaults to true.",
      },
      maxFailures: {
        type: "number",
        description: "Cap the number of returned failures. Defaults to 50.",
      },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const last = getLastRun();
    if (!last) {
      return {
        content: [{ type: "text", text: "No cached run. Call cypress_run first." }],
        isError: true,
      };
    }

    if (last.status === "failed") {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { status: "failed", setupError: last.setupError, projectRoot: last.projectRoot },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    const specFilter = (args.specFilter as string | undefined)?.toLowerCase();
    const includeStack = args.includeStack !== false;
    const maxFailures = (args.maxFailures as number | undefined) ?? 50;

    const failures: unknown[] = [];
    for (const spec of last.runs) {
      if (specFilter && !spec.spec.relative.toLowerCase().includes(specFilter)) continue;
      for (const test of spec.tests) {
        if (test.state !== "failed") continue;
        const finalAttempt = test.attempts[test.attempts.length - 1];
        failures.push({
          spec: spec.spec.relative,
          fullTitle: test.fullTitle,
          displayError: test.displayError,
          attempts: test.attempts.length,
          error: finalAttempt?.error
            ? {
                name: finalAttempt.error.name,
                message: finalAttempt.error.message,
                stack: includeStack ? finalAttempt.error.stack : undefined,
                codeFrame: finalAttempt.error.codeFrame,
              }
            : undefined,
          screenshots: finalAttempt?.screenshots?.map((s) => s.path) ?? [],
          duration: finalAttempt?.duration,
          videoTimestamp: finalAttempt?.videoTimestamp,
          video: spec.video,
        });
        if (failures.length >= maxFailures) break;
      }
      if (failures.length >= maxFailures) break;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              totalFailed: last.totalFailed,
              returned: failures.length,
              failures,
            },
            null,
            2,
          ),
        },
      ],
      isError: failures.length > 0,
    };
  },
};
