import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type SpecLanguage = "ts" | "js";

export function detectSpecLanguage(projectRoot: string): SpecLanguage {
  return existsSync(path.join(projectRoot, "tsconfig.json")) ? "ts" : "js";
}

export function specTemplate(title: string, language: SpecLanguage): string {
  const header =
    language === "ts" ? "/// <reference types=\"cypress\" />\n\n" : "";
  return `${header}describe(${JSON.stringify(title)}, () => {
  it("works", () => {
    // MCP_APPEND_HERE
  });
});
`;
}

export async function ensureSpec(
  absSpecPath: string,
  title: string,
  language: SpecLanguage,
): Promise<void> {
  const exists = await stat(absSpecPath).catch(() => null);
  if (exists) return;
  await mkdir(path.dirname(absSpecPath), { recursive: true });
  await writeFile(absSpecPath, specTemplate(title, language), "utf8");
}

export async function appendLines(absSpecPath: string, lines: string[]): Promise<void> {
  const current = await readFile(absSpecPath, "utf8");
  const markerRe = /([ \t]*)\/\/ MCP_APPEND_HERE/;
  const m = current.match(markerRe);
  if (m) {
    const indent = m[1];
    const body = lines.map((l) => indent + l).join("\n");
    const replaced = current.replace(markerRe, `${body}\n${indent}// MCP_APPEND_HERE`);
    await writeFile(absSpecPath, replaced, "utf8");
    return;
  }
  const fallbackIndent = "    ";
  const body = lines.map((l) => fallbackIndent + l).join("\n");
  const idx = current.lastIndexOf("});");
  if (idx === -1) {
    await writeFile(absSpecPath, current + "\n" + body + "\n", "utf8");
    return;
  }
  const next = current.slice(0, idx) + body + "\n" + current.slice(idx);
  await writeFile(absSpecPath, next, "utf8");
}

export function defaultSpecPath(projectRoot: string, name: string, language: SpecLanguage): string {
  const safe = name.replace(/[^\w.-]+/g, "-");
  const file = safe.endsWith(`.cy.${language}`) ? safe : `${safe}.cy.${language}`;
  return path.join(projectRoot, "cypress", "e2e", file);
}

export function q(v: string): string {
  return JSON.stringify(v);
}

export function obj(v: unknown): string {
  return JSON.stringify(v);
}
