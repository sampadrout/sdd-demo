import type { Locator } from "playwright";

export type ElementAttrs = {
  tag: string | null;
  dataCy: string | null;
  dataTestid: string | null;
  dataTest: string | null;
  id: string | null;
  name: string | null;
  ariaLabel: string | null;
  role: string | null;
  type: string | null;
  text: string | null;
};

export type Suggestion = { rank: number; cypress: string; rationale: string };

export function suggestionsFromAttrs(a: ElementAttrs): Suggestion[] {
  const out: Suggestion[] = [];
  if (a.dataCy) out.push({ rank: 1, cypress: `cy.get('[data-cy="${a.dataCy}"]')`, rationale: "data-cy (Cypress convention)" });
  if (a.dataTestid) out.push({ rank: 2, cypress: `cy.get('[data-testid="${a.dataTestid}"]')`, rationale: "data-testid" });
  if (a.dataTest) out.push({ rank: 2, cypress: `cy.get('[data-test="${a.dataTest}"]')`, rationale: "data-test" });
  if (a.id) out.push({ rank: 3, cypress: `cy.get('#${a.id}')`, rationale: "id (fragile if dynamic)" });
  if (a.ariaLabel) out.push({ rank: 4, cypress: `cy.get('[aria-label="${a.ariaLabel}"]')`, rationale: "aria-label" });
  if (a.tag === "input" && a.name) out.push({ rank: 5, cypress: `cy.get('input[name="${a.name}"]')`, rationale: "input name" });
  if (a.tag === "button" && a.text) out.push({ rank: 5, cypress: `cy.contains('button', ${JSON.stringify(a.text)})`, rationale: "button text" });
  if (a.tag === "a" && a.text) out.push({ rank: 6, cypress: `cy.contains('a', ${JSON.stringify(a.text)})`, rationale: "link text" });
  if (a.tag && a.type) out.push({ rank: 7, cypress: `cy.get('${a.tag}[type="${a.type}"]')`, rationale: "tag + type" });
  out.sort((x, y) => x.rank - y.rank);
  return out;
}

export async function attrsFromLocator(locator: Locator): Promise<ElementAttrs> {
  return locator.evaluate((el) => {
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

export async function suggestForLocator(
  locator: Locator,
): Promise<{ best: string; suggestions: Suggestion[]; attrs: ElementAttrs }> {
  const attrs = await attrsFromLocator(locator);
  const suggestions = suggestionsFromAttrs(attrs);
  return {
    best: suggestions[0]?.cypress ?? `cy.get(${JSON.stringify(attrs.tag ?? "*")})`,
    suggestions,
    attrs,
  };
}
