import type { Browser, BrowserContext, ConsoleMessage, Page, Request, Response } from "playwright";

type BrowserKind = "chromium" | "firefox" | "webkit";

export type ConsoleEntry = { level: string; text: string; ts: number; location?: string };
export type NetworkEntry = {
  url: string;
  method: string;
  status?: number;
  fromCache?: boolean;
  duration?: number;
  ts: number;
  resourceType?: string;
};

type State = {
  browser: Browser | null;
  context: BrowserContext | null;
  page: Page | null;
  kind: BrowserKind | null;
  consoleBuf: ConsoleEntry[];
  networkBuf: NetworkEntry[];
  requestStart: Map<Request, number>;
};

const state: State = {
  browser: null,
  context: null,
  page: null,
  kind: null,
  consoleBuf: [],
  networkBuf: [],
  requestStart: new Map(),
};

/**
 * In-flight launch. MCP tool handlers run concurrently, so a subsequent tool
 * call can arrive before launch() finishes spawning the browser. Holding the
 * promise here lets requirePage() wait for it.
 */
let launchInFlight: Promise<{ kind: BrowserKind; headless: boolean }> | null = null;

const MAX_BUF = 1000;

export type LaunchOptions = {
  kind?: BrowserKind;
  headless?: boolean;
  viewport?: { width: number; height: number };
  userAgent?: string;
  storageStatePath?: string;
};

export async function isLaunched(): Promise<boolean> {
  return state.browser !== null && state.page !== null;
}

export async function launch(opts: LaunchOptions = {}): Promise<{ kind: BrowserKind; headless: boolean }> {
  if (state.page) {
    return { kind: state.kind!, headless: opts.headless ?? false };
  }
  if (launchInFlight) return launchInFlight;
  launchInFlight = (async () => {
    const mod = await import("playwright");
    const kind = opts.kind ?? "chromium";
    const launcher = kind === "firefox" ? mod.firefox : kind === "webkit" ? mod.webkit : mod.chromium;
    const headless = opts.headless ?? false;
    let browser;
    try {
      browser = await launcher.launch({ headless });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/Executable doesn't exist|browserType.launch/.test(msg)) {
        throw new Error(
          `Playwright browser binary missing. Run: npx playwright install ${kind}\n\nOriginal error: ${msg}`,
        );
      }
      throw e;
    }
    const context = await browser.newContext({
      viewport: opts.viewport ?? { width: 1280, height: 800 },
      userAgent: opts.userAgent,
      storageState: opts.storageStatePath,
    });
    const page = await context.newPage();
    attachRecorders(page);
    // Commit state atomically at the end.
    state.browser = browser;
    state.context = context;
    state.page = page;
    state.kind = kind;
    return { kind, headless };
  })();
  try {
    return await launchInFlight;
  } catch (e) {
    launchInFlight = null;
    throw e;
  }
}

function attachRecorders(page: Page): void {
  page.on("console", (msg: ConsoleMessage) => {
    const loc = msg.location();
    pushBounded(state.consoleBuf, {
      level: msg.type(),
      text: msg.text(),
      ts: Date.now(),
      location: loc.url ? `${loc.url}:${loc.lineNumber}:${loc.columnNumber}` : undefined,
    });
  });
  page.on("request", (req: Request) => {
    state.requestStart.set(req, Date.now());
    pushBounded(state.networkBuf, {
      url: req.url(),
      method: req.method(),
      ts: Date.now(),
      resourceType: req.resourceType(),
    });
  });
  page.on("response", (res: Response) => {
    const req = res.request();
    const started = state.requestStart.get(req);
    const entry = findLastPendingFor(req.url());
    if (entry) {
      entry.status = res.status();
      entry.fromCache = res.fromServiceWorker() ? false : undefined;
      entry.duration = started ? Date.now() - started : undefined;
    }
    state.requestStart.delete(req);
  });
  page.on("requestfailed", (req: Request) => {
    const entry = findLastPendingFor(req.url());
    if (entry) {
      entry.status = -1;
    }
    state.requestStart.delete(req);
  });
}

function findLastPendingFor(url: string): NetworkEntry | undefined {
  for (let i = state.networkBuf.length - 1; i >= 0; i--) {
    if (state.networkBuf[i].url === url && state.networkBuf[i].status === undefined) {
      return state.networkBuf[i];
    }
  }
  return undefined;
}

function pushBounded<T>(buf: T[], v: T): void {
  buf.push(v);
  if (buf.length > MAX_BUF) buf.shift();
}

export async function close(): Promise<void> {
  if (state.browser) {
    try {
      await state.browser.close();
    } catch {
      /* ignore */
    }
  }
  state.browser = null;
  state.context = null;
  state.page = null;
  state.kind = null;
  state.consoleBuf = [];
  state.networkBuf = [];
  state.requestStart.clear();
  launchInFlight = null;
}

export async function requirePage(): Promise<Page> {
  if (launchInFlight) {
    try {
      await launchInFlight;
    } catch {
      /* surfaced via !state.page below */
    }
  }
  if (!state.page) throw new Error("Live browser not launched. Call cypress_live_launch first.");
  return state.page;
}

export function consoleMessages(level?: string): ConsoleEntry[] {
  return level ? state.consoleBuf.filter((e) => e.level === level) : [...state.consoleBuf];
}

export function networkRequests(filter?: string): NetworkEntry[] {
  return filter
    ? state.networkBuf.filter((e) => e.url.toLowerCase().includes(filter.toLowerCase()))
    : [...state.networkBuf];
}

export function clearBuffers(): void {
  state.consoleBuf = [];
  state.networkBuf = [];
  state.requestStart.clear();
}
