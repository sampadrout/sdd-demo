import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition } from "../types.js";
import { getLastRun } from "../state.js";
import { resolveProjectRoot } from "../util/project.js";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB, MCP clients handle this fine

function mimeFor(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

export const getScreenshot: ToolDefinition = {
  name: "cypress_get_screenshot",
  description:
    "Return a screenshot as an image. Either pass an absolute 'path', or pass 'testTitle' (substring match against the fully-qualified test name) to fetch the failure screenshot from the most recent run.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute path to a PNG/JPEG screenshot." },
      testTitle: {
        type: "string",
        description: "Substring of a failing test's full title. Uses the cached last run.",
      },
      projectRoot: { type: "string", description: "Used to resolve relative paths." },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    let target = args.path as string | undefined;

    if (!target && args.testTitle) {
      const last = getLastRun();
      if (!last) {
        return {
          content: [{ type: "text", text: "No cached run. Call cypress_run first." }],
          isError: true,
        };
      }
      const needle = (args.testTitle as string).toLowerCase();
      outer: for (const spec of last.runs) {
        for (const test of spec.tests) {
          if (!test.fullTitle.toLowerCase().includes(needle)) continue;
          const finalAttempt = test.attempts[test.attempts.length - 1];
          const shot = finalAttempt?.screenshots?.[0];
          if (shot) {
            target = shot.path;
            break outer;
          }
        }
      }
      if (!target) {
        return {
          content: [
            {
              type: "text",
              text: `No screenshot found for test matching "${args.testTitle}".`,
            },
          ],
          isError: true,
        };
      }
    }

    if (!target) {
      return {
        content: [{ type: "text", text: "Provide either 'path' or 'testTitle'." }],
        isError: true,
      };
    }

    if (!path.isAbsolute(target)) {
      target = path.resolve(resolveProjectRoot(args.projectRoot as string | undefined), target);
    }

    const info = await stat(target).catch(() => null);
    if (!info || !info.isFile()) {
      return {
        content: [{ type: "text", text: `Screenshot not found at ${target}` }],
        isError: true,
      };
    }
    if (info.size > MAX_BYTES) {
      return {
        content: [
          {
            type: "text",
            text: `Screenshot at ${target} is ${info.size} bytes, exceeds ${MAX_BYTES} limit.`,
          },
        ],
        isError: true,
      };
    }

    const buf = await readFile(target);
    return {
      content: [
        { type: "text", text: `Screenshot: ${target}` },
        { type: "image", data: buf.toString("base64"), mimeType: mimeFor(target) },
      ],
    };
  },
};
