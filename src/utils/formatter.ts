import { SweepResult } from "../classification/pipeline";

export function formatSweep(sweep: SweepResult): string {
  const direction = sweep.type === "call" ? "bullish" : "bearish";
  const signal = sweep.score.signal.replace("_", " ");
  const iv = Math.round(sweep.impliedVolatility * 100);
  const distance = Math.abs(
    ((sweep.strike - sweep.currentPrice) / sweep.currentPrice) * 100
  ).toFixed(1);
  const detected = new Date(sweep.detectedAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/New_York",
  });

  return [
    `${sweep.symbol} ${sweep.strike}${sweep.type.toUpperCase()} ${sweep.expiration}`,
    `Signal: ${signal} (${sweep.score.composite}/100)`,
    `Direction: ${direction} | IV: ${iv}% | Strike ${distance}% from price`,
    `Volume: ${sweep.volume.toLocaleString()} contracts | OI: ${sweep.openInterest.toLocaleString()}`,
    `Detected: ${detected} ET`,
    `Scores — Volume: ${sweep.score.volumeAnomaly} | Order: ${sweep.score.orderCharacter} | IV: ${sweep.score.ivContext} | Strike: ${sweep.score.strikeSelection} | GEX: ${sweep.score.gexPosition}`,
  ].join("\n");
}

export function formatSweepList(sweeps: SweepResult[]): string {
  if (sweeps.length === 0) return "No significant sweeps detected.";

  return sweeps
    .sort((a, b) => b.score.composite - a.score.composite)
    .map((s, i) => `#${i + 1}\n${formatSweep(s)}`)
    .join("\n\n");
}