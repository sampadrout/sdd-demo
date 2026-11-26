export type ToolResult = {
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
  >;
  isError?: boolean;
};

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
};

export type TestAttempt = {
  state: "passed" | "failed" | "pending" | "skipped";
  error?: {
    name?: string;
    message: string;
    stack?: string;
    codeFrame?: unknown;
  };
  duration?: number;
  screenshots?: Array<{ path: string; takenAt?: string; height?: number; width?: number }>;
  videoTimestamp?: number;
  startedAt?: string;
};

export type TestRecord = {
  title: string[];
  fullTitle: string;
  state: "passed" | "failed" | "pending" | "skipped";
  displayError?: string;
  attempts: TestAttempt[];
};

export type SpecRunRecord = {
  spec: {
    name: string;
    relative: string;
    absolute: string;
  };
  stats: {
    tests: number;
    passes: number;
    failures: number;
    pending: number;
    skipped: number;
    duration: number;
  };
  video?: string | null;
  tests: TestRecord[];
};

export type RunSummary = {
  startedAt: string;
  endedAt: string;
  totalDuration: number;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalPending: number;
  totalSkipped: number;
  browserName?: string;
  browserVersion?: string;
  cypressVersion?: string;
  runs: SpecRunRecord[];
  projectRoot: string;
  config?: string;
  status: "finished" | "failed";
  setupError?: string;
};
