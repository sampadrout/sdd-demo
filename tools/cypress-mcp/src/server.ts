#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { tools, toolMap } from "./tools/index.js";

const server = new Server(
  { name: "cypress-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = toolMap.get(name);
  if (!tool) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }
  try {
    return await tool.handler((args ?? {}) as Record<string, unknown>);
  } catch (err) {
    const message = err instanceof Error ? err.stack ?? err.message : String(err);
    return {
      content: [{ type: "text", text: `Tool ${name} failed:\n${message}` }],
      isError: true,
    };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console
  console.error("cypress-mcp server ready on stdio");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("cypress-mcp fatal:", err);
  process.exit(1);
});
