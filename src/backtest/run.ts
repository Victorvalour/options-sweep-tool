import { BACKTEST_CASES, BacktestCase } from "./cases";
import { scoreContract } from "../classification/scoring";
import { calculateIV } from "../utils/blackscholes";

interface BacktestResult {
  id: number;
  date: string;
  symbol: string;
  strike: number;
  type: string;
  actualOutcome: string;
  expectedSignal: string;
  actualSignal: string;
  composite: number;
  signalMatch: boolean;
  outcomeMatch: boolean;
}

function runBacktest(): void {
  const results: BacktestResult[] = [];
  let signalMatches = 0;
  let outcomeMatches = 0;
  let strongInstitutionalProfitable = 0;
  let strongInstitutionalTotal = 0;

  for (const c of BACKTEST_CASES) {
    const iv = calculateIV(
      c.lastPrice,
      c.stockPriceAtSweep,
      c.strike,
      c.daysToExpiration,
      c.type
    );

    const contract = {
      strike: c.strike,
      bid: c.bid,
      ask: c.ask,
      volume: c.volume,
      openInterest: c.openInterest,
      impliedVolatility: iv,
      lastPrice: c.lastPrice,
      inTheMoney:
        c.type === "call"
          ? c.strike < c.stockPriceAtSweep
          : c.strike > c.stockPriceAtSweep,
    };

    const score = scoreContract(
      contract,
      null,
      c.stockPriceAtSweep,
      c.daysToExpiration,
      null
    );

    const signalMatch = score.signal === c.expectedSignal;
    const outcomeMatch =
      (score.signal === "strong_institutional" && c.actualOutcome === "profitable") ||
      (score.signal === "retail_momentum" && c.actualOutcome === "unprofitable") ||
      (score.signal === "mixed");

    if (signalMatch) signalMatches++;
    if (outcomeMatch) outcomeMatches++;

    if (score.signal === "strong_institutional") {
      strongInstitutionalTotal++;
      if (c.actualOutcome === "profitable") strongInstitutionalProfitable++;
    }

    results.push({
      id: c.id,
      date: c.date,
      symbol: c.symbol,
      strike: c.strike,
      type: c.type,
      actualOutcome: c.actualOutcome,
      expectedSignal: c.expectedSignal,
      actualSignal: score.signal,
      composite: score.composite,
      signalMatch,
      outcomeMatch,
    });
  }

  console.log("\n=== BACKTEST RESULTS ===\n");
  console.log(`Total cases: ${BACKTEST_CASES.length}`);
  console.log(`Signal classification matches: ${signalMatches}/${BACKTEST_CASES.length} (${Math.round(signalMatches / BACKTEST_CASES.length * 100)}%)`);
  console.log(`Outcome prediction matches: ${outcomeMatches}/${BACKTEST_CASES.length} (${Math.round(outcomeMatches / BACKTEST_CASES.length * 100)}%)`);
  console.log(`Strong institutional → profitable: ${strongInstitutionalProfitable}/${strongInstitutionalTotal} (${Math.round(strongInstitutionalProfitable / strongInstitutionalTotal * 100)}%)`);

  console.log("\n=== CASE BREAKDOWN ===\n");
  for (const r of results) {
    const status = r.signalMatch ? "✅" : "❌";
    console.log(`${status} #${r.id} ${r.date} ${r.symbol} ${r.strike}${r.type.toUpperCase()} | Expected: ${r.expectedSignal} | Got: ${r.actualSignal} (${r.composite}) | Outcome: ${r.actualOutcome}`);
  }
}

runBacktest();