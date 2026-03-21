import { Contract } from "../adapters/yahoo";
import { Baseline } from "../data/baselines";
import { EquityContext } from "../adapters/alpaca";
import { StrikeOI } from "../adapters/cboe";

export interface SweepScore {
  volumeAnomaly: number;
  orderCharacter: number;
  ivContext: number;
  strikeSelection: number;
  gexPosition: number;
  composite: number;
  signal: "strong_institutional" | "mixed" | "retail_momentum";
}

export function scoreContract(
  contract: Contract,
  baseline: Baseline | null,
  currentPrice: number,
  daysToExpiration: number,
  strikeOI: StrikeOI | null,
  context?: EquityContext
): SweepScore {
  const volumeAnomaly = scoreVolumeAnomaly(contract, baseline, context);
  const orderCharacter = scoreOrderCharacter(contract);
  const ivContext = scoreIVContext(contract, baseline);
  const strikeSelection = scoreStrikeSelection(contract, currentPrice, daysToExpiration);
  const gexPosition = scoreGEX(strikeOI);

  const composite = Math.round(
    volumeAnomaly * 0.3 +
    orderCharacter * 0.25 +
    ivContext * 0.2 +
    strikeSelection * 0.15 +
    gexPosition * 0.1
  );

  const signal =
    composite >= 62
      ? "strong_institutional"
      : composite >= 45
      ? "mixed"
      : "retail_momentum";

  return {
    volumeAnomaly,
    orderCharacter,
    ivContext,
    strikeSelection,
    gexPosition,
    composite,
    signal,
  };
}

function scoreVolumeAnomaly(
  contract: Contract,
  baseline: Baseline | null,
  context?: EquityContext
): number {
  let score = 50;

  if (baseline && baseline.avgVolume > 0) {
    const ratio = contract.volume / baseline.avgVolume;
    if (ratio >= 10) score = 100;
    else if (ratio >= 5) score = 80;
    else if (ratio >= 3) score = 60;
    else if (ratio >= 2) score = 40;
    else score = 20;
  } else {
    if (contract.volume >= 10000) score = 100;
    else if (contract.volume >= 5000) score = 80;
    else if (contract.volume >= 1000) score = 70;
    else if (contract.volume >= 500) score = 60;
    else if (contract.volume >= 100) score = 50;
    else score = 30;
  }

  if (context) {
    if (context.relativeVolume >= 2) score = Math.min(100, score + 10);
    else if (context.relativeVolume < 0.5) score = Math.max(0, score - 10);
  }

  return score;
}

function scoreOrderCharacter(contract: Contract): number {
  const spread = contract.ask - contract.bid;
  const midpoint = (contract.ask + contract.bid) / 2;
  const executedAtAsk = contract.lastPrice >= contract.ask * 0.98;
  const tightSpread = midpoint > 0 && spread / midpoint < 0.05;
  const hasVolume = contract.volume > 100;

  let score = 0;
  if (executedAtAsk) score += 50;
  if (tightSpread) score += 30;
  if (hasVolume) score += 20;
  return score;
}

function scoreIVContext(contract: Contract, baseline: Baseline | null): number {
  if (contract.impliedVolatility === 0) return 50;
  if (!baseline) return 50;
  if (baseline.ivPercentile <= 20) return 100;
  if (baseline.ivPercentile <= 40) return 75;
  if (baseline.ivPercentile <= 60) return 50;
  if (baseline.ivPercentile <= 80) return 25;
  return 10;
}

function scoreStrikeSelection(
  contract: Contract,
  currentPrice: number,
  daysToExpiration: number
): number {
  const distancePercent =
    (Math.abs(contract.strike - currentPrice) / currentPrice) * 100;
  const isShortDated = daysToExpiration <= 7;

  if (distancePercent >= 5 && isShortDated) return 100;
  if (distancePercent >= 3 && isShortDated) return 80;
  if (distancePercent >= 2) return 60;
  if (distancePercent >= 1) return 40;
  return 20;
}

function scoreGEX(strikeOI: StrikeOI | null): number {
  if (!strikeOI) return 50;
  const totalOI = strikeOI.callOI + strikeOI.putOI;
  if (totalOI === 0) return 50;
  const callBias = strikeOI.callOI / totalOI;
  if (callBias >= 0.7) return 80;
  if (callBias <= 0.3) return 80;
  return 40;
}