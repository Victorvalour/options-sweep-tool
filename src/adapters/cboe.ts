import axios from "axios";
import redis from "../queue/redis";

const CACHE_KEY = "cboe:oi";
const CACHE_TTL = 86400;

export interface StrikeOI {
  strike: number;
  callOI: number;
  putOI: number;
}

export async function getOpenInterest(symbol: string): Promise<StrikeOI[]> {
  const cached = await redis.get(`${CACHE_KEY}:${symbol}`);
  if (cached) return JSON.parse(cached);

  const { data } = await axios.get(
    `https://cdn.cboe.com/api/global/delayed_quotes/options/${symbol}.json`
  );

  const options: any[] = data.data.options;
  const strikeMap = new Map<number, { callOI: number; putOI: number }>();

  for (const o of options) {
    const name: string = o.option;
    const typeChar = name.charAt(symbol.length + 6);
    const strike = parseInt(name.slice(symbol.length + 7)) / 1000;
    const oi: number = o.open_interest ?? 0;

    if (!strikeMap.has(strike)) {
      strikeMap.set(strike, { callOI: 0, putOI: 0 });
    }

    const entry = strikeMap.get(strike)!;
    if (typeChar === "C") entry.callOI += oi;
    else entry.putOI += oi;
  }

  const result: StrikeOI[] = Array.from(strikeMap.entries()).map(
    ([strike, { callOI, putOI }]) => ({ strike, callOI, putOI })
  );

  await redis.setex(`${CACHE_KEY}:${symbol}`, CACHE_TTL, JSON.stringify(result));

  return result;
}