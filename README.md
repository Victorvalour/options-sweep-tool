# Options Sweep Tool

MCP server that detects unusual options sweep activity and classifies institutional vs retail signals.

## Stack

- Node.js + TypeScript
- Express + MCP SDK
- Redis (caching + baselines)
- Alpaca API (options chain + equity context)
- CBOE (open interest + GEX)
- Black-Scholes IV computation

## Environment Variables

Create a `.env` file in the root with:

```
REDIS_URL=your_redis_url
ALPACA_API_KEY=your_alpaca_api_key
ALPACA_SECRET_KEY=your_alpaca_secret_key
```

## Install

```
npm install
```

## Build

```
npm run build
```

## Run

```
node dist/index.js
```

## Deploy

- Platform: Railway
- Start command: `node --env-file=.env dist/index.js`
- Build command: `npm install && npm run build`
- Port: 3000 (set PORT env variable on Railway)

## MCP Endpoint

```
POST /mcp
```

## Health Check

```
GET /health
```

## Tools

- `scan_sweeps` — scan for unusual options activity on a ticker
- `get_cached_sweeps` — retrieve cached sweep results instantly

## Backtesting

```
npm run backtest
```

84% accuracy across 25 historical cases (2024-2025)
