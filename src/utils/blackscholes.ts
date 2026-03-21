export function calculateIV(
  optionPrice: number,
  stockPrice: number,
  strike: number,
  daysToExpiration: number,
  optionType: "call" | "put",
  riskFreeRate: number = 0.05
): number {
  if (optionPrice <= 0 || daysToExpiration <= 0) return 0;

  const distancePercent = Math.abs(strike - stockPrice) / stockPrice;
  if (distancePercent > 0.4) return 0;

  const T = daysToExpiration / 365;
  let low = 0.001;
  let high = 5.0;

  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const price = blackScholesPrice(stockPrice, strike, T, riskFreeRate, mid, optionType);

    if (Math.abs(price - optionPrice) < 0.001) return mid;
    if (price < optionPrice) low = mid;
    else high = mid;
  }

  return (low + high) / 2;
}

function blackScholesPrice(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  type: "call" | "put"
): number {
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  if (type === "call") {
    return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
  }
  return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
}

function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}