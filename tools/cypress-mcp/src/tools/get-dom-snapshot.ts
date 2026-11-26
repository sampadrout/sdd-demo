import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition } from "../types.js";
import { resolveProjectRoot } from "../util/project.js";

type IndexEntry = {
  slug: string;
  spec: string;
  test: string;
  error: string;
  ts: number;
  htmlPath: string;
  metaPath: string;
};

async function readIndex(projectRoot: string): Promise<IndexEntry[]> {
  const p = path.join(projectRoot, "cypress", "logs", "dom-snapshots.json");
  const info = await stat(p).catch(() => null);
  if (!info) return [];
  const raw = await readFile(p, "utf8");
  return raw
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l) as IndexEntry;
      } catch {
        return null;
      }
    })
    .filter((x): x is IndexEntry => !!x);
}

function findLatest(index: IndexEntry[], specFilter?: string, testFilter?: string): IndexEntry | null {
  const scored = index
    .filter((e) => {
      if (specFilter && !e.spec.toLowerCase().includes(specFilter.toLowerCase())) return false;
      if (testFilter && !e.test.toLowerCase().includes(testFilter.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => b.ts - a.ts);
  return scored[0] ?? null;
}

export const getDomSnapshot: ToolDefinition = {
  name: "cypress_get_dom_snapshot",
  description:
    "Return the DOM captured at the moment of a test failure, plus the page URL and the test's error message. Requires cypress_install_log_hooks to have run. Used by the healer agent to understand why a selector missed.",
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: { type: "string" },
      specFilter: {
        type: "string",
        description: "Substring of the spec's relative path (e.g. 'login').",
      },
      testFilter: {
        type: "string",
        description: "Substring of the failing test's full title (e.g. 'signs in with valid creds').",
      },
      list: {
        type: "boolean",
        description: "If true, return an index of available snapshots instead of the DOM.",
      },
      maxChars: { type: "number", description: "Truncate DOM to this length. Default 200000." },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const projectRoot = resolveProjectRoot(args.projectRoot as string | undefined);
    const index = await readIndex(projectRoot);
    if (index.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No DOM snapshots. Call cypress_install_log_hooks, then cypress_run against a spec that fails.",
          },
        ],
        isError: true,
      };
    }
    if (args.list) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                count: index.length,
                snapshots: index.map((e) => ({ slug: e.slug, spec: e.spec, test: e.test, error: e.error, ts: e.ts })),
              },
              null,
              2,
            ),
          },
        ],
      };
    }
    const entry = findLatest(index, args.specFilter as string | undefined, args.testFilter as string | undefined);
    if (!entry) {
      return { content: [{ type: "text", text: "No snapshot matched the filters." }], isError: true };
    }
    const html = await readFile(entry.htmlPath, "utf8");
    const maxChars = (args.maxChars as number | undefined) ?? 200000;
    const truncated = html.length > maxChars ? html.slice(0, maxChars) + "\n<!-- truncated -->" : html;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              spec: entry.spec,
              test: entry.test,
              url: "",
              error: entry.error,
              htmlPath: entry.htmlPath,
              htmlBytes: html.length,
              html: truncated,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
};
