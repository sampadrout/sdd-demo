import { existsSync } from "node:fs";
import { cp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import type { ToolDefinition } from "../types.js";

/**
 * Locate the `skills/` directory shipped with this package. Works in both
 * `dist/` and `src/` layouts.
 */
function resolveSkillsSource(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../../skills"),
    path.resolve(here, "../../../skills"),
    path.resolve(here, "../skills"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(`Could not locate skills/ directory (checked: ${candidates.join(", ")})`);
}

export const installSkills: ToolDefinition = {
  name: "cypress_install_skills",
  description:
    "Install the three Cypress agent skills (cypress-planner, cypress-generator, cypress-healer) into a target directory. Defaults to ~/.claude/skills/. Use project-scoped `.claude/skills/` by passing `scope: \"project\"`. Idempotent (overwrites on repeat).",
  inputSchema: {
    type: "object",
    properties: {
      scope: {
        type: "string",
        enum: ["user", "project"],
        description: "user = ~/.claude/skills/; project = <projectRoot>/.claude/skills/. Defaults to user.",
      },
      projectRoot: {
        type: "string",
        description: "Required when scope=project. Skills go to <projectRoot>/.claude/skills/.",
      },
      targetDir: {
        type: "string",
        description: "Override: absolute path to install skills into (wins over scope).",
      },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const src = resolveSkillsSource();
    let dst: string;
    if (args.targetDir) {
      dst = path.resolve(String(args.targetDir));
    } else if ((args.scope ?? "user") === "project") {
      if (!args.projectRoot) {
        return {
          content: [{ type: "text", text: "projectRoot is required when scope=project." }],
          isError: true,
        };
      }
      dst = path.resolve(String(args.projectRoot), ".claude", "skills");
    } else {
      dst = path.join(os.homedir(), ".claude", "skills");
    }

    await mkdir(dst, { recursive: true });

    const entries = await readdir(src, { withFileTypes: true });
    const copied: string[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const from = path.join(src, e.name);
      const to = path.join(dst, e.name);
      await cp(from, to, { recursive: true, force: true });
      copied.push(to);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              source: src,
              target: dst,
              installed: copied,
              note: "Skills are picked up on the next Claude Code session / skill reload. Invoke via /cypress-planner, /cypress-generator, /cypress-healer.",
            },
            null,
            2,
          ),
        },
      ],
    };
  },
};
