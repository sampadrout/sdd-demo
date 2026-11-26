import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition } from "../types.js";
import { resolveProjectRoot } from "../util/project.js";
import { defaultSpecPath, detectSpecLanguage, ensureSpec, type SpecLanguage } from "../util/spec-builder.js";
import { getSession, setCurrentSpec, setProjectRoot } from "../session.js";

export const newSpec: ToolDefinition = {
  name: "cypress_new_spec",
  description:
    "Create a new Cypress spec file with describe/it scaffolding and set it as the session's current spec (subsequent cypress_append_steps calls will target it).",
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: { type: "string" },
      name: {
        type: "string",
        description: "Spec name (without extension). Written to cypress/e2e/<name>.cy.{ts,js}.",
      },
      title: { type: "string", description: "describe() title. Defaults to the name." },
      path: {
        type: "string",
        description: "Override full destination path (absolute or relative to projectRoot).",
      },
      language: { type: "string", enum: ["ts", "js"], description: "Spec language. Auto-detected." },
    },
    required: ["name"],
    additionalProperties: false,
  },
  handler: async (args) => {
    const projectRoot = resolveProjectRoot(args.projectRoot as string | undefined);
    setProjectRoot(projectRoot);
    const language =
      (args.language as SpecLanguage | undefined) ?? detectSpecLanguage(projectRoot);
    const name = args.name as string;
    const title = (args.title as string | undefined) ?? name;
    const override = args.path as string | undefined;
    const abs = override
      ? path.isAbsolute(override)
        ? override
        : path.resolve(projectRoot, override)
      : defaultSpecPath(projectRoot, name, language);
    await ensureSpec(abs, title, language);
    setCurrentSpec(abs);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { currentSpec: abs, relative: path.relative(projectRoot, abs), language },
            null,
            2,
          ),
        },
      ],
    };
  },
};

export const setCurrent: ToolDefinition = {
  name: "cypress_set_current_spec",
  description: "Set the session's current spec file. Subsequent append/run_current calls target it.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute or relative spec path." },
      projectRoot: { type: "string" },
    },
    required: ["path"],
    additionalProperties: false,
  },
  handler: async (args) => {
    const projectRoot = resolveProjectRoot(args.projectRoot as string | undefined);
    setProjectRoot(projectRoot);
    const p = args.path as string;
    const abs = path.isAbsolute(p) ? p : path.resolve(projectRoot, p);
    setCurrentSpec(abs);
    return { content: [{ type: "text", text: JSON.stringify({ currentSpec: abs }) }] };
  },
};

export const getCurrent: ToolDefinition = {
  name: "cypress_get_current_spec",
  description: "Return the session's current spec path (or null).",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  handler: async () => {
    const s = getSession();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ currentSpec: s.currentSpec, projectRoot: s.projectRoot }),
        },
      ],
    };
  },
};

export const showSpec: ToolDefinition = {
  name: "cypress_show_spec",
  description: "Return the contents of a spec file (defaults to the current spec).",
  inputSchema: {
    type: "object",
    properties: { path: { type: "string" } },
    additionalProperties: false,
  },
  handler: async (args) => {
    const s = getSession();
    const target = (args.path as string | undefined) ?? s.currentSpec;
    if (!target) {
      return {
        content: [{ type: "text", text: "No current spec. Call cypress_new_spec or cypress_set_current_spec first." }],
        isError: true,
      };
    }
    const abs = path.isAbsolute(target) ? target : path.resolve(s.projectRoot, target);
    const body = await readFile(abs, "utf8");
    return {
      content: [
        { type: "text", text: `// ${abs}\n\n${body}` },
      ],
    };
  },
};
