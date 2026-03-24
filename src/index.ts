import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express, { Request, Response } from "express";
import { createContextMiddleware } from "@ctxprotocol/sdk";
import { classifySymbol, getCachedSweeps } from "./classification/pipeline";
import { getEquityContext } from "./adapters/alpaca";
import { computeBaselines } from "./data/baselines";
import { formatSweepList } from "./utils/formatter";
import cron from "node-cron";
import "dotenv/config";


const app = express();
app.use(express.json());
app.use("/mcp", createContextMiddleware());

const TOOLS = [
  {
    name: "scan_sweeps",
    description:
      "Scan for unusual options sweep activity on a given ticker. Detects large block orders with anomalous volume, order character, IV context, and strike selection. Returns plain-English signal classification within 30 seconds.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "The ticker symbol to scan e.g. SPY, QQQ, AAPL, TSLA, NVDA",
          default: "SPY",
          examples: ["SPY", "QQQ", "AAPL", "TSLA", "NVDA"],
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string" },
        sweepsFound: { type: "number" },
        topSweeps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              strike: { type: "number" },
              expiration: { type: "string" },
              type: { type: "string" },
              volume: { type: "number" },
              openInterest: { type: "number" },
              composite: { type: "number" },
              signal: { type: "string" },
            },
          },
        },
        summary: { type: "string" },
      },
      required: ["symbol", "sweepsFound", "topSweeps", "summary"],
    },
  },
  {
    name: "get_cached_sweeps",
    description:
      "Retrieve the most recently detected sweeps for a ticker from the intraday cache. Returns results instantly.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "The ticker symbol to retrieve cached sweeps for",
          default: "SPY",
          examples: ["SPY", "QQQ", "AAPL", "TSLA", "NVDA"],
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        symbol: { type: "string" },
        sweepsFound: { type: "number" },
        topSweeps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              strike: { type: "number" },
              expiration: { type: "string" },
              type: { type: "string" },
              volume: { type: "number" },
              openInterest: { type: "number" },
              composite: { type: "number" },
              signal: { type: "string" },
            },
          },
        },
        summary: { type: "string" },
      },
      required: ["symbol", "sweepsFound", "topSweeps", "summary"],
    },
  },
];

cron.schedule("0 20 * * 1-5", async () => {
  const watchlist = ["SPY", "QQQ", "AAPL", "TSLA", "NVDA"];
  for (const symbol of watchlist) {
    await computeBaselines(symbol).catch(console.error);
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.post("/mcp", async (req: Request, res: Response) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  const server = new Server(
    { name: "options-sweep-tool", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const symbol = ((args?.symbol as string) ?? "SPY").toUpperCase();

    if (name === "scan_sweeps") {
      const { price } = await getEquityContext(symbol);
      const sweeps = await classifySymbol(symbol, price);
      const top = sweeps.slice(0, 10);
      const data = {
        symbol,
        sweepsFound: sweeps.length,
        topSweeps: top.map((s) => ({
          strike: s.strike,
          expiration: s.expiration,
          type: s.type,
          volume: s.volume,
          openInterest: s.openInterest,
          composite: s.score.composite,
          signal: s.score.signal,
        })),
        summary: formatSweepList(top),
      };
      return {
        content: [{ type: "text", text: data.summary }],
        structuredContent: data,
      };
    }

    if (name === "get_cached_sweeps") {
      const sweeps = await getCachedSweeps(symbol);
      const top = sweeps.slice(0, 10);
      const data = {
        symbol,
        sweepsFound: sweeps.length,
        topSweeps: top.map((s) => ({
          strike: s.strike,
          expiration: s.expiration,
          type: s.type,
          volume: s.volume,
          openInterest: s.openInterest,
          composite: s.score.composite,
          signal: s.score.signal,
        })),
        summary: formatSweepList(top),
      };
      return {
        content: [{ type: "text", text: data.summary }],
        structuredContent: data,
      };
    }

    throw new Error(`Unknown tool: ${name}` );
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));