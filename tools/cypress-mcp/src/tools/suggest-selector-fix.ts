import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition } from "../types.js";
import { resolveProjectRoot } from "../util/project.js";
import { suggestionsFromAttrs, type ElementAttrs } from "../browser/locator-suggest.js";

type IndexEntry = { slug: string; spec: string; test: string; error: string; ts: number; htmlPath: string };

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

function pickLatest(index: IndexEntry[], specFilter?: string, testFilter?: string): IndexEntry | null {
  const filtered = index
    .filter((e) => {
      if (specFilter && !e.spec.toLowerCase().includes(specFilter.toLowerCase())) return false;
      if (testFilter && !e.test.toLowerCase().includes(testFilter.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => b.ts - a.ts);
  return filtered[0] ?? null;
}

/**
 * Strip a Cypress selector down to the raw DOM selector portion.
 * `cy.get('#foo').click()` -> `#foo`; `cy.contains('button', 'Save')` -> `button:has-text("Save")`
 */
function extractRawSelector(failingSelector: string): { css: string | null; textSearch: string | null; tag: string | null } {
  let s = failingSelector.trim();
  if (s.startsWith("cy.")) s = s.slice(3);
  const getMatch = s.match(/^get\(\s*['"`]([^'"`]+)['"`]\s*\)/);
  if (getMatch) return { css: getMatch[1], textSearch: null, tag: null };
  const containsMatch = s.match(/^contains\(\s*['"`]([^'"`]+)['"`]\s*(?:,\s*['"`]([^'"`]+)['"`])?\s*\)/);
  if (containsMatch) {
    const a = containsMatch[1];
    const b = containsMatch[2];
    if (b) return { css: a, textSearch: b, tag: a };
    return { css: null, textSearch: a, tag: null };
  }
  return { css: s, textSearch: null, tag: null };
}

async function analyzeDom(
  html: string,
  failing: { css: string | null; textSearch: string | null; tag: string | null },
): Promise<{
  originalMatches: number;
  neighborCandidates: Array<{ attrs: ElementAttrs; suggestion: string; rationale: string }>;
  textCandidates: Array<{ attrs: ElementAttrs; suggestion: string; rationale: string }>;
}> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const originalMatches = failing.css
      ? await page.locator(failing.css).count().catch(() => 0)
      : 0;

    async function attrsOf(handle: import("playwright").ElementHandle): Promise<ElementAttrs> {
      return handle.evaluate((el) => {
        const e = el as HTMLElement;
        return {
          tag: e.tagName.toLowerCase(),
          dataCy: e.getAttribute("data-cy"),
          dataTestid: e.getAttribute("data-testid"),
          dataTest: e.getAttribute("data-test"),
          id: e.id || null,
          name: e.getAttribute("name"),
          ariaLabel: e.getAttribute("aria-label"),
          role: e.getAttribute("role"),
          type: e.getAttribute("type"),
          text: (e.textContent || "").trim().slice(0, 80) || null,
        };
      });
    }

    // 1. Text-based candidates: find elements containing the searched text.
    const textCandidates: Array<{ attrs: ElementAttrs; suggestion: string; rationale: string }> = [];
    if (failing.textSearch) {
      const matching = await page.locator(`text=${failing.textSearch}`).elementHandles();
      for (const h of matching.slice(0, 5)) {
        const attrs = await attrsOf(h);
        const ranked = suggestionsFromAttrs(attrs);
        if (ranked[0]) textCandidates.push({ attrs, suggestion: ranked[0].cypress, rationale: ranked[0].rationale });
      }
    }

    // 2. Fuzzy attribute-based candidates from the original selector.
    const neighborCandidates: Array<{ attrs: ElementAttrs; suggestion: string; rationale: string }> = [];
    if (failing.css) {
      // Derive likely alternates from the failing selector.
      const idMatch = failing.css.match(/^#([\w-]+)/);
      const classMatch = failing.css.match(/\.([\w-]+)/);
      const attrMatch = failing.css.match(/\[([\w-]+)(?:[*^$~]?=)?['"]?([^'"\]]*)['"]?\]/);
      const tagMatch = failing.css.match(/^([a-z][a-z0-9-]*)/i);

      const probes: string[] = [];
      const tokenize = (s: string): string[] =>
        s
          .split(/[-_\s]+|(?=[A-Z])/)
          .map((t) => t.toLowerCase())
          .filter((t) => t.length >= 3 && !["the", "and", "btn", "div", "span"].includes(t));
      const pushTokenProbes = (value: string) => {
        probes.push(`[id*="${value}"]`, `[data-cy*="${value}"]`, `[data-testid*="${value}"]`, `[name*="${value}"]`, `[aria-label*="${value}"]`);
        for (const tok of tokenize(value)) {
          probes.push(`[id*="${tok}"]`, `[data-cy*="${tok}"]`, `[data-testid*="${tok}"]`, `[name*="${tok}"]`);
        }
      };
      if (idMatch) pushTokenProbes(idMatch[1]);
      if (classMatch) pushTokenProbes(classMatch[1]);
      if (attrMatch) {
        const [, name, value] = attrMatch;
        if (value) {
          probes.push(`[${name}*="${value}"]`);
          for (const tok of tokenize(value)) probes.push(`[${name}*="${tok}"]`);
        }
      }
      if (tagMatch) probes.push(tagMatch[1]);

      const seen = new Set<string>();
      for (const probe of probes) {
        try {
          const handles = await page.locator(probe).elementHandles();
          for (const h of handles.slice(0, 3)) {
            const attrs = await attrsOf(h);
            const key = `${attrs.tag}#${attrs.id ?? ""}.${attrs.dataCy ?? ""}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const ranked = suggestionsFromAttrs(attrs);
            if (ranked[0]) {
              neighborCandidates.push({
                attrs,
                suggestion: ranked[0].cypress,
                rationale: `matched probe \`${probe}\` — ${ranked[0].rationale}`,
              });
            }
          }
        } catch {
          /* bad probe, skip */
        }
        if (neighborCandidates.length >= 8) break;
      }
    }

    return { originalMatches, neighborCandidates, textCandidates };
  } finally {
    await browser.close().catch(() => {});
  }
}

export const suggestSelectorFix: ToolDefinition = {
  name: "cypress_suggest_selector_fix",
  description:
    "Given a failing selector (or a failing test), analyze the DOM captured at failure time and propose ranked alternative Cypress selectors. Requires cypress_install_log_hooks + a prior failing run.",
  inputSchema: {
    type: "object",
    properties: {
      projectRoot: { type: "string" },
      failingSelector: {
        type: "string",
        description: "The Cypress selector that failed, e.g. `cy.get('#submit')` or `cy.contains('Save')`.",
      },
      specFilter: { type: "string" },
      testFilter: { type: "string" },
      htmlPath: {
        type: "string",
        description: "Optional absolute path to a saved DOM snapshot HTML file (overrides spec/test filters).",
      },
    },
    required: ["failingSelector"],
    additionalProperties: false,
  },
  handler: async (args) => {
    const projectRoot = resolveProjectRoot(args.projectRoot as string | undefined);

    let html: string;
    let source: string;
    if (args.htmlPath) {
      source = String(args.htmlPath);
      html = await readFile(source, "utf8");
    } else {
      const index = await readIndex(projectRoot);
      const entry = pickLatest(
        index,
        args.specFilter as string | undefined,
        args.testFilter as string | undefined,
      );
      if (!entry) {
        return {
          content: [
            {
              type: "text",
              text: "No DOM snapshots available. Install hooks and run a failing test first.",
            },
          ],
          isError: true,
        };
      }
      source = entry.htmlPath;
      html = await readFile(entry.htmlPath, "utf8");
    }

    const failing = extractRawSelector(String(args.failingSelector));
    const analysis = await analyzeDom(html, failing);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              snapshot: source,
              parsedFailing: failing,
              originalMatches: analysis.originalMatches,
              verdict:
                analysis.originalMatches > 0
                  ? "selector matches DOM — not a selector problem. Check visibility, timing, or assertions."
                  : "selector does NOT match DOM — candidates below, ranked best first.",
              textCandidates: analysis.textCandidates,
              neighborCandidates: analysis.neighborCandidates,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
};
