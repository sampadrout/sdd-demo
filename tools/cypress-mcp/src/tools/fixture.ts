import fg from "fast-glob";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition } from "../types.js";
import { resolveProjectRoot } from "../util/project.js";

function fixturePath(projectRoot: string, name: string): string {
  const safe = name.endsWith(".json") ? name : `${name}.json`;
  return path.join(projectRoot, "cypress", "fixtures", safe);
}

export const manageFixture: ToolDefinition = {
  name: "cypress_manage_fixture",
  description:
    "CRUD on cypress/fixtures/*.json. Actions: list, read, write, delete. Used by the generator agent to build stable test data.",
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: { type: "string" },
      action: { type: "string", enum: ["list", "read", "write", "delete"] },
      name: {
        type: "string",
        description: "Fixture name (with or without .json). Required for read/write/delete.",
      },
      data: {
        description: "JSON-serializable data (required for write).",
      },
    },
    required: ["action"],
    additionalProperties: false,
  },
  handler: async (args) => {
    const projectRoot = resolveProjectRoot(args.projectRoot as string | undefined);
    const action = String(args.action);
    const fixturesDir = path.join(projectRoot, "cypress", "fixtures");

    if (action === "list") {
      const matches = await fg("**/*.json", { cwd: fixturesDir, absolute: false }).catch(() => []);
      return {
        content: [{ type: "text", text: JSON.stringify({ fixturesDir, count: matches.length, fixtures: matches }, null, 2) }],
      };
    }

    if (!args.name) {
      return { content: [{ type: "text", text: "`name` is required for read/write/delete." }], isError: true };
    }
    const p = fixturePath(projectRoot, String(args.name));

    if (action === "read") {
      const info = await stat(p).catch(() => null);
      if (!info) return { content: [{ type: "text", text: `No fixture at ${p}` }], isError: true };
      const raw = await readFile(p, "utf8");
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
      return { content: [{ type: "text", text: JSON.stringify({ path: p, data: parsed }, null, 2) }] };
    }

    if (action === "write") {
      if (args.data === undefined) {
        return { content: [{ type: "text", text: "`data` is required for write." }], isError: true };
      }
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, JSON.stringify(args.data, null, 2), "utf8");
      return { content: [{ type: "text", text: `Wrote fixture ${p} (${JSON.stringify(args.data).length} bytes).` }] };
    }

    if (action === "delete") {
      await rm(p, { force: true });
      return { content: [{ type: "text", text: `Deleted ${p}` }] };
    }

    return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
  },
};

export const seedFromApi: ToolDefinition = {
  name: "cypress_seed_from_api",
  description:
    "Make an HTTP request to a real API and save the response body as a fixture. The generator uses this to turn production-like data into reusable mocks.",
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: { type: "string" },
      url: { type: "string" },
      method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"] },
      headers: { type: "object", additionalProperties: { type: "string" } },
      body: { description: "Request body (JSON-serializable)." },
      fixtureName: {
        type: "string",
        description: "Fixture file name. Defaults to slugified URL path.",
      },
    },
    required: ["url"],
    additionalProperties: false,
  },
  handler: async (args) => {
    const projectRoot = resolveProjectRoot(args.projectRoot as string | undefined);
    const url = String(args.url);
    const method = String(args.method ?? "GET");
    const res = await fetch(url, {
      method,
      headers: (args.headers as Record<string, string> | undefined) ?? undefined,
      body: args.body !== undefined ? JSON.stringify(args.body) : undefined,
    });
    const ct = res.headers.get("content-type") ?? "";
    let payload: unknown;
    if (ct.includes("application/json")) {
      payload = await res.json();
    } else {
      payload = await res.text();
    }

    const defaultName = new URL(url).pathname.replace(/\//g, "-").replace(/^-+|-+$/g, "") || "seed";
    const name = (args.fixtureName as string | undefined) ?? defaultName;
    const p = fixturePath(projectRoot, name);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, JSON.stringify(payload, null, 2), "utf8");

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { url, method, status: res.status, savedTo: p, bytes: JSON.stringify(payload).length },
            null,
            2,
          ),
        },
      ],
      isError: !res.ok,
    };
  },
};
