import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request, Response } from "express";
//import { createContextMiddleware } from "@ctxprotocol/sdk";
import { z } from "zod";
import { classifySymbol, getCachedSweeps } from "./classification/pipeline";
import { getQuote } from "./adapters/yahoo";
import { computeBaselines } from "./data/baselines";
import { formatSweepList } from "./utils/formatter";
import cron from "node-cron";

const app = express();
app.use(express.json());
//app.use("/mcp", createContextMiddleware());

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

  const server = new McpServer({
    name: "options-sweep-tool",
    version: "1.0.0",
  });

  server.tool(
    "scan_sweeps",
    "Scan for unusual options sweep activity on a given ticker. Detects large block orders with anomalous volume, order character, IV context, and strike selection. Returns plain-English signal classification within 30 seconds.",
    {
      symbol: z
        .string()
        .default("SPY")
        .describe("The ticker symbol to scan e.g. SPY, QQQ, AAPL, TSLA, NVDA"),
    },
    async ({ symbol = "SPY" }) => {
    const sym = symbol.toUpperCase();
      const { price } = await getQuote(sym);
      const sweeps = await classifySymbol(sym, price);
      const top = sweeps.slice(0, 10);
      const data = {
        symbol: sym,
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
  );

  server.tool(
    "get_cached_sweeps",
    "Retrieve the most recently detected sweeps for a ticker from the intraday cache. Returns results instantly.",
    {
      symbol: z
        .string()
        .default("SPY")
        .describe("The ticker symbol to retrieve cached sweeps for"),
    },
    async ({ symbol = "SPY" }) => {
    const sym = symbol.toUpperCase();
      const sweeps = await getCachedSweeps(sym);
      const top = sweeps.slice(0, 10);
      const data = {
        symbol: sym,
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
  );

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));