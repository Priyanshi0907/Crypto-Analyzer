/**
 * indicators.js
 * Real, textbook technical-analysis indicators computed client-side.
 * None of this is AI/ML — it's standard finance math, and is labelled
 * honestly in the UI as "technical indicators", not "AI predictions".
 *
 * All functions take/return plain arrays of numbers unless noted.
 */

export function sma(values, period) {
  const out = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    out.push(sum / period);
  }
  return out;
}

export function ema(values, period) {
  const k = 2 / (period + 1);
  const out = [];
  let prev;
  values.forEach((v, i) => {
    if (i === 0) { prev = v; out.push(v); return; }
    prev = v * k + prev * (1 - k);
    out.push(prev);
  });
  return out;
}

export function rsi(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = 100 - 100 / (1 + (avgLoss === 0 ? avgGain : avgGain / avgLoss));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? avgGain : avgGain / avgLoss;
    out[i] = avgLoss === 0 && avgGain === 0 ? 50 : 100 - 100 / (1 + rs);
  }
  return out;
}

export function macd(closes, fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = closes.map((_, i) => emaFast[i] - emaSlow[i]);
  const signalLine = ema(macdLine, signalPeriod);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macdLine, signalLine, histogram };
}

export function bollingerBands(closes, period = 20, mult = 2) {
  const mid = sma(closes, period);
  const upper = [], lower = [];
  for (let i = 0; i < closes.length; i++) {
    if (mid[i] === null) { upper.push(null); lower.push(null); continue; }
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) sumSq += (closes[j] - mid[i]) ** 2;
    const stdDev = Math.sqrt(sumSq / period);
    upper.push(mid[i] + mult * stdDev);
    lower.push(mid[i] - mult * stdDev);
  }
  return { mid, upper, lower };
}

export function atr(highs, lows, closes, period = 14) {
  const trueRanges = closes.map((c, i) => {
    if (i === 0) return highs[i] - lows[i];
    return Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
  });
  return ema(trueRanges, period);
}

export function stochasticRSI(closes, period = 14) {
  const rsiVals = rsi(closes, period);
  const out = new Array(closes.length).fill(null);
  for (let i = 0; i < closes.length; i++) {
    if (i < period * 2 - 1) continue;
    const window = rsiVals.slice(i - period + 1, i + 1).filter((v) => v !== null);
    if (window.length < period) continue;
    const min = Math.min(...window);
    const max = Math.max(...window);
    out[i] = max === min ? 0 : ((rsiVals[i] - min) / (max - min)) * 100;
  }
  return out;
}

export function vwap(highs, lows, closes, volumes) {
  let cumPV = 0, cumVol = 0;
  return closes.map((c, i) => {
    const typicalPrice = (highs[i] + lows[i] + c) / 3;
    cumPV += typicalPrice * volumes[i];
    cumVol += volumes[i];
    return cumVol === 0 ? null : cumPV / cumVol;
  });
}

/**
 * Ordinary least-squares linear regression over the last `lookback` points.
 * This is genuine (simple) statistics — a trend line, not a trained model.
 * Returns { slope, intercept, nextValue, r2 } so the UI can show its
 * actual confidence (r2) instead of presenting it as a confident forecast.
 */
export function linearRegressionForecast(closes, lookback = 30) {
  const y = closes.slice(-lookback);
  const n = y.length;
  const x = y.map((_, i) => i);
  const xMean = x.reduce((a, b) => a + b, 0) / n;
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - xMean) * (y[i] - yMean);
    den += (x[i] - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;

  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = slope * x[i] + intercept;
    ssRes += (y[i] - pred) ** 2;
    ssTot += (y[i] - yMean) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  const nextValue = slope * n + intercept;
  return { slope, intercept, nextValue, r2, lookback: n };
}

/**
 * Day-over-day percentage returns (as decimals, e.g. 0.02 = +2%).
 * Underlies both volatility and Sharpe ratio below.
 */
export function dailyReturns(closes) {
  const out = [];
  for (let i = 1; i < closes.length; i++) {
    if (!closes[i - 1]) { out.push(0); continue; }
    out.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return out;
}

function meanAndStdDev(values) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1);
  return { mean, stdDev: Math.sqrt(variance) };
}

/**
 * Annualized volatility (%) — the standard deviation of daily returns,
 * scaled to a yearly figure (× √365), expressed as a percentage. This is
 * a descriptive measure of how much the price swings, not a prediction.
 */
export function annualizedVolatility(closes) {
  const returns = dailyReturns(closes);
  if (returns.length < 2) return null;
  const { stdDev } = meanAndStdDev(returns);
  return stdDev * Math.sqrt(365) * 100;
}

/**
 * A simplified Sharpe ratio: annualized mean return ÷ annualized volatility,
 * assuming a 0% risk-free rate (the usual crypto-analysis simplification)
 * over whatever window of daily closes is passed in. Higher = more return
 * per unit of volatility over that specific window — it is backward-looking
 * and window-dependent, not a forecast.
 */
export function sharpeRatio(closes, riskFreeAnnual = 0) {
  const returns = dailyReturns(closes);
  if (returns.length < 2) return null;
  const { mean, stdDev } = meanAndStdDev(returns);
  if (stdDev === 0) return null;
  const annualizedReturn = mean * 365;
  const annualizedStdDev = stdDev * Math.sqrt(365);
  return (annualizedReturn - riskFreeAnnual) / annualizedStdDev;
}