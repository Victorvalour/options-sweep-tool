import redis from "../queue/redis";
import { fetchCBOEData } from "../adapters/yahoo";

const BASELINE_TTL = 86400;

export interface Baseline {
  symbol: string;
  strike: number;
  expiration: string;
  avgVolume: number;
  ivPercentile: number;
  updatedAt: number;
}

export async function computeBaselines(symbol: string): Promise<void> {
  const { chains, price } = await fetchCBOEData(symbol, 0);

  for (const chain of chains) {
    const contracts = [...chain.calls, ...chain.puts];

    for (const contract of contracts) {
      const key = `baseline:${symbol}:${chain.expiration}:${contract.strike}`;

      const existing = await redis.get(key);
      const prev: Baseline | null = existing ? JSON.parse(existing) : null;

      const avgVolume = prev
        ? Math.round((prev.avgVolume * 29 + contract.volume) / 30)
        : contract.volume;

      const ivPercentile = prev
        ? calculateIVPercentile(contract.impliedVolatility, prev.ivPercentile)
        : 50;

      const baseline: Baseline = {
        symbol,
        strike: contract.strike,
        expiration: chain.expiration,
        avgVolume,
        ivPercentile,
        updatedAt: Date.now(),
      };

      await redis.setex(key, BASELINE_TTL, JSON.stringify(baseline));
    }
  }
}

export async function getBaseline(
  symbol: string,
  expiration: string,
  strike: number
): Promise<Baseline | null> {
  const key = `baseline:${symbol}:${expiration}:${strike}`;
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

function calculateIVPercentile(currentIV: number, prevPercentile: number): number {
  const weight = 0.1;
  const normalizedIV = Math.min(Math.max(currentIV * 100, 0), 100);
  return Math.round(prevPercentile * (1 - weight) + normalizedIV * weight);
}