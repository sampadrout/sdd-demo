import type { ToolDefinition } from "../../types.js";
import { requirePage } from "../../browser/manager.js";

export const liveEnumerateLinks: ToolDefinition = {
  name: "cypress_live_enumerate_links",
  description:
    "Return all <a href> links on the live page: href, text, visibility, in-domain flag. Used by the planner agent to discover routes efficiently.",
  inputSchema: {
    type: "object",
    properties: {
      sameOriginOnly: { type: "boolean", description: "Filter to same-origin links. Defaults to true." },
      limit: { type: "number", description: "Max results. Default 200." },
      includeHidden: { type: "boolean", description: "Include visually hidden links. Defaults to false." },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const page = await requirePage();
    const origin = new URL(page.url()).origin;
    const sameOriginOnly = args.sameOriginOnly !== false;
    const includeHidden = Boolean(args.includeHidden);
    const limit = (args.limit as number | undefined) ?? 200;
    const links = await page.evaluate(
      ({ pageOrigin, includeHiddenFlag }) => {
        const out: Array<{ href: string; text: string; visible: boolean; sameOrigin: boolean; title: string; target: string; rel: string }> = [];
        const anchors = document.querySelectorAll("a[href]");
        anchors.forEach((a) => {
          const el = a as HTMLAnchorElement;
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          const visible =
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            rect.width > 0 &&
            rect.height > 0;
          if (!includeHiddenFlag && !visible) return;
          let sameOrigin = false;
          try {
            sameOrigin = new URL(el.href, pageOrigin).origin === pageOrigin;
          } catch {
            sameOrigin = false;
          }
          out.push({
            href: el.href,
            text: (el.textContent || "").trim().slice(0, 120),
            visible,
            sameOrigin,
            title: el.title || "",
            target: el.target || "",
            rel: el.rel || "",
          });
        });
        return out;
      },
      { pageOrigin: origin, includeHiddenFlag: includeHidden },
    );
    const filtered = sameOriginOnly ? links.filter((l) => l.sameOrigin) : links;
    const unique = new Map<string, (typeof filtered)[number]>();
    for (const l of filtered) {
      if (!unique.has(l.href)) unique.set(l.href, l);
    }
    const result = [...unique.values()].slice(0, limit);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ page: page.url(), count: result.length, links: result }, null, 2),
        },
      ],
    };
  },
};

export const liveDiscoverForms: ToolDefinition = {
  name: "cypress_live_discover_forms",
  description:
    "Return all <form> elements on the live page with their fields (name, type, required, placeholder, label). Used by the planner agent to understand input surfaces.",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Max forms. Default 50." },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const page = await requirePage();
    const limit = (args.limit as number | undefined) ?? 50;
    const forms = await page.evaluate((max: number) => {
      const formEls = Array.from(document.querySelectorAll("form")).slice(0, max);
      return formEls.map((f, idx) => {
        const form = f as HTMLFormElement;
        const labelFor = (el: HTMLElement): string | null => {
          if (!el.id) return null;
          const lab = document.querySelector(`label[for="${el.id}"]`);
          return lab ? (lab.textContent || "").trim().slice(0, 80) : null;
        };
        const fields = Array.from(form.querySelectorAll("input, select, textarea, button")).map((e) => {
          const el = e as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement;
          return {
            tag: el.tagName.toLowerCase(),
            type: (el as HTMLInputElement).type || null,
            name: el.getAttribute("name"),
            id: el.id || null,
            dataCy: el.getAttribute("data-cy"),
            dataTestid: el.getAttribute("data-testid"),
            ariaLabel: el.getAttribute("aria-label"),
            placeholder: (el as HTMLInputElement).placeholder || null,
            required: (el as HTMLInputElement).required || false,
            label: labelFor(el),
            value: (el as HTMLInputElement).value || null,
          };
        });
        return {
          index: idx,
          id: form.id || null,
          action: form.action || null,
          method: form.method || "GET",
          name: form.getAttribute("name"),
          ariaLabel: form.getAttribute("aria-label"),
          fields,
        };
      });
    }, limit);
    return {
      content: [
        { type: "text", text: JSON.stringify({ page: page.url(), count: forms.length, forms }, null, 2) },
      ],
    };
  },
};

export const liveDiscoverInteractive: ToolDefinition = {
  name: "cypress_live_discover_interactive",
  description:
    "Return all interactive elements (buttons, links, role=button, clickable inputs) with stable-selector suggestions. High-signal view of what a user can do on the page.",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Default 100." },
    },
    additionalProperties: false,
  },
  handler: async (args) => {
    const page = await requirePage();
    const limit = (args.limit as number | undefined) ?? 100;
    const items = await page.evaluate((max: number) => {
      const sel =
        'button, a[href], [role="button"], [role="link"], [role="menuitem"], [role="tab"], input[type=submit], input[type=button], [onclick]';
      const els = Array.from(document.querySelectorAll(sel)).slice(0, max);
      return els.map((e) => {
        const el = e as HTMLElement;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute("role"),
          text: (el.textContent || "").trim().slice(0, 80),
          href: (el as HTMLAnchorElement).href || null,
          id: el.id || null,
          dataCy: el.getAttribute("data-cy"),
          dataTestid: el.getAttribute("data-testid"),
          ariaLabel: el.getAttribute("aria-label"),
          disabled: (el as HTMLButtonElement).disabled || false,
          visible:
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            rect.width > 0 &&
            rect.height > 0,
        };
      });
    }, limit);
    return {
      content: [
        { type: "text", text: JSON.stringify({ page: page.url(), count: items.length, items }, null, 2) },
      ],
    };
  },
};
