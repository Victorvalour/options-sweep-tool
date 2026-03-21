import { fetchCBOEData } from "../adapters/yahoo";
import { getEquityContext, EquityContext } from "../adapters/alpaca";
import { getBaseline } from "../data/baselines";
import { scoreContract, SweepScore } from "./scoring";
import redis from "../queue/redis";

export interface SweepResult {
  symbol: string;
  strike: number;
  expiration: string;
  type: "call" | "put";
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  currentPrice: number;
  score: SweepScore;
  detectedAt: number;
}

export async function classifySymbol(
  symbol: string,
  currentPrice: number
): Promise<SweepResult[]> {
  const [context, cboe] = await Promise.all([
    getEquityContext(symbol),
    fetchCBOEData(symbol, currentPrice),
  ]);

  const price = context.price || cboe.price || currentPrice;
  const { chains, oiMap } = cboe;
  const results: SweepResult[] = [];

  for (const chain of chains) {
    const daysToExpiration = Math.round(
      (new Date(chain.expiration).getTime() - Date.now()) / 86400000
    );

    const qualifying = [
      ...chain.calls.filter((c) => c.volume >= 10).map((c) => ({ contract: c, type: "call" as const })),
      ...chain.puts.filter((c) => c.volume >= 10).map((c) => ({ contract: c, type: "put" as const })),
    ];

    const baselines = await Promise.all(
      qualifying.map(({ contract }) =>
        getBaseline(symbol, chain.expiration, contract.strike)
      )
    );

    for (let i = 0; i < qualifying.length; i++) {
      const { contract, type } = qualifying[i];
      const baseline = baselines[i];
      const strikeOIData = oiMap[contract.strike];
      const strikeOI = strikeOIData
        ? { strike: contract.strike, callOI: strikeOIData.callOI, putOI: strikeOIData.putOI }
        : null;

      const score = scoreContract(
        contract,
        baseline,
        price,
        daysToExpiration,
        strikeOI,
        context
      );

      if (score.composite < 30) continue;

      results.push({
        symbol,
        strike: contract.strike,
        expiration: chain.expiration,
        type,
        volume: contract.volume,
        openInterest: strikeOI
          ? strikeOI.callOI + strikeOI.putOI
          : contract.openInterest,
        impliedVolatility: contract.impliedVolatility,
        currentPrice: price,
        score,
        detectedAt: Date.now(),
      });
    }
  }

  if (results.length > 0) {
    await redis.setex(`sweeps:${symbol}`, 3600, JSON.stringify(results));
  }

  return results;
}

export async function getCachedSweeps(symbol: string): Promise<SweepResult[]> {
  const cached = await redis.get(`sweeps:${symbol}`);
  return cached ? JSON.parse(cached) : [];
}