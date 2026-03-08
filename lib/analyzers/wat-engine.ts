// ============================================================
// AirwayLab — WAT (Wobble Analysis Tool) Engine
// Ported from wat-reference-component.tsx
// FL Score, Regularity Score (SampEn), Periodicity Index (FFT)
// ============================================================

import type { WATResults } from '../types';

/**
 * Run the complete WAT analysis on flow data.
 */
export function computeWAT(flowData: Float32Array, samplingRate: number): WATResults {
  const flScore = analyzeFlowLimitation(flowData, samplingRate);
  const estimatedArousalIndex = computeEstimatedArousalIndex(flowData, samplingRate);
  const minuteVent = calculateMinuteVent(flowData, samplingRate);

  if (minuteVent.length < 4) {
    return { flScore, regularityScore: 0, periodicityIndex: 0, estimatedArousalIndex };
  }

  const { regularityScore, periodicityIndex } = analyzePeriodicBreathing(minuteVent);

  return { flScore, regularityScore, periodicityIndex, estimatedArousalIndex };
}

// ============================================================
// Flow Limitation Score (0-100)
// Measures mechanical upper airway obstruction via inspiratory
// flow shape. Higher = more flattened flow patterns = worse.
// ============================================================
function analyzeFlowLimitation(flowData: Float32Array, _samplingRate: number): number {
  const flScores: number[] = [];
  let inInspiration = false;
  let inspirationStart = 0;

  for (let i = 1; i < flowData.length; i++) {
    if (flowData[i] > 0 && flowData[i - 1] <= 0) {
      // Positive-going crossing → inspiration start
      inspirationStart = i;
      inInspiration = true;
    } else if (flowData[i] <= 0 && flowData[i - 1] > 0 && inInspiration) {
      // Negative-going crossing → inspiration end
      const inspEnd = i;
      const inspLen = inspEnd - inspirationStart;

      if (inspLen >= 10) {
        // Extract and analyze this inspiration
        const score = scoreInspiration(flowData, inspirationStart, inspEnd);
        if (score >= 0) flScores.push(score);
      }

      inInspiration = false;
    }
  }

  if (flScores.length === 0) return 0;
  return flScores.reduce((a, b) => a + b, 0) / flScores.length;
}

function scoreInspiration(
  flowData: Float32Array,
  start: number,
  end: number
): number {
  let maxFlow = 0;
  for (let i = start; i < end; i++) {
    if (flowData[i] > maxFlow) maxFlow = flowData[i];
  }
  if (maxFlow < 0.1) return -1;

  // Find top half region (normalized flow > 0.5)
  let topStart = -1;
  let topEnd = -1;

  for (let i = start; i < end; i++) {
    if (flowData[i] / maxFlow > 0.5) {
      if (topStart === -1) topStart = i;
      topEnd = i;
    }
  }

  if (topStart === -1 || topEnd <= topStart) return -1;

  // Variance of normalized top half
  const topLen = topEnd - topStart + 1;
  let sum = 0;
  for (let i = topStart; i <= topEnd; i++) {
    sum += flowData[i] / maxFlow;
  }
  const mean = sum / topLen;

  let variance = 0;
  for (let i = topStart; i <= topEnd; i++) {
    const diff = flowData[i] / maxFlow - mean;
    variance += diff * diff;
  }
  variance /= topLen;

  // Flatness score: low variance = flat = flow limited
  return Math.max(0, Math.min(100, ((0.05 - variance) / 0.05) * 100));
}

// ============================================================
// Minute Ventilation calculation
// 60-second sliding windows, 5-second steps
// ============================================================
function calculateMinuteVent(flowData: Float32Array, samplingRate: number): number[] {
  const windowSize = Math.floor(60 * samplingRate);
  const stepSize = Math.floor(5 * samplingRate);
  const minuteVent: number[] = [];

  for (let i = 0; i <= flowData.length - windowSize; i += stepSize) {
    let tidalVolume = 0;
    let breathCount = 0;
    let inInhalation = false;

    for (let j = 1; j < windowSize; j++) {
      const idx = i + j;
      if (flowData[idx] > 0 && flowData[idx - 1] <= 0) {
        breathCount++;
        inInhalation = true;
      }
      if (inInhalation && flowData[idx] > 0) {
        tidalVolume += Math.abs(flowData[idx]) / samplingRate;
      }
      if (flowData[idx] <= 0) {
        inInhalation = false;
      }
    }

    const mv = (tidalVolume * breathCount) / 60;
    minuteVent.push(mv);
  }

  return minuteVent;
}

// ============================================================
// Periodicity & Regularity analysis
// Sample Entropy + FFT on minute ventilation
// ============================================================
function analyzePeriodicBreathing(minuteVent: number[]): {
  regularityScore: number;
  periodicityIndex: number;
} {
  // Sample Entropy → Regularity Score
  const sampleEntropy = calculateSampleEntropy(minuteVent);
  const regularityScore = Math.max(0, Math.min(100, 100 - (sampleEntropy / 2.5) * 100));

  // FFT → Periodicity Index
  const mean = minuteVent.reduce((a, b) => a + b, 0) / minuteVent.length;
  const detrended = minuteVent.map((v) => v - mean);

  const n = nextPow2(detrended.length);
  const padded = new Array<number>(n).fill(0);
  for (let i = 0; i < detrended.length; i++) padded[i] = detrended[i];

  const complex = padded.map((v) => ({ re: v, im: 0 }));
  const spectrum = fft(complex);
  const power = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    power[i] = Math.sqrt(spectrum[i].re ** 2 + spectrum[i].im ** 2);
  }

  const dt = 5; // 5-second steps
  let totalPower = 0;
  let pbBandPower = 0;

  for (let i = 0; i < power.length; i++) {
    totalPower += power[i];
    const freq = i / (n * dt);
    // Periodic breathing band: 0.01-0.03 Hz (~30-100 second cycles)
    if (freq >= 0.01 && freq <= 0.03) {
      pbBandPower += power[i];
    }
  }

  const periodicityIndex =
    totalPower > 0 ? Math.min(100, (pbBandPower / totalPower) * 200) : 0;

  return { regularityScore, periodicityIndex };
}

// ============================================================
// Sample Entropy
// Measures complexity/predictability of a time series
// ============================================================
function calculateSampleEntropy(data: number[], m = 2, r: number | null = null): number {
  const N = data.length;
  if (N < m + 2) return 0;

  if (r === null) {
    const mean = data.reduce((a, b) => a + b, 0) / N;
    let variance = 0;
    for (let i = 0; i < N; i++) {
      variance += (data[i] - mean) ** 2;
    }
    variance /= N;
    r = 0.2 * Math.sqrt(variance);
  }

  if (r === 0) return 0;

  const countMatches = (templateLen: number): number => {
    let count = 0;
    for (let i = 0; i < N - templateLen; i++) {
      for (let j = i + 1; j < N - templateLen; j++) {
        let match = true;
        for (let k = 0; k < templateLen; k++) {
          if (Math.abs(data[i + k] - data[j + k]) > r!) {
            match = false;
            break;
          }
        }
        if (match) count++;
      }
    }
    return count;
  };

  const B = countMatches(m);
  const A = countMatches(m + 1);

  if (B === 0 || A === 0) return 0;
  return -Math.log(A / B);
}

// ============================================================
// FFT (Cooley-Tukey radix-2)
// ============================================================
interface Complex {
  re: number;
  im: number;
}

function fft(x: Complex[]): Complex[] {
  const N = x.length;
  if (N <= 1) return x;

  const even: Complex[] = [];
  const odd: Complex[] = [];
  for (let i = 0; i < N; i++) {
    if (i % 2 === 0) even.push(x[i]);
    else odd.push(x[i]);
  }

  const evenResult = fft(even);
  const oddResult = fft(odd);

  const result: Complex[] = new Array(N);
  for (let k = 0; k < N / 2; k++) {
    const angle = (-2 * Math.PI * k) / N;
    const t: Complex = {
      re: Math.cos(angle) * oddResult[k].re - Math.sin(angle) * oddResult[k].im,
      im: Math.cos(angle) * oddResult[k].im + Math.sin(angle) * oddResult[k].re,
    };
    result[k] = { re: evenResult[k].re + t.re, im: evenResult[k].im + t.im };
    result[k + N / 2] = { re: evenResult[k].re - t.re, im: evenResult[k].im - t.im };
  }
  return result;
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

// ============================================================
// Estimated Arousal Index (EAI)
// Ported from wobble-analysis-tool (existentialblu/WAT)
// Detects arousal events via respiratory rate increase >20%
// OR tidal volume increase >30% vs 120-second sliding baseline.
// 15-second refractory period suppresses duplicate detections.
// ============================================================
const EAI_BASELINE_WINDOW_SECONDS = 120;
const EAI_RATE_THRESHOLD = 0.20;
const EAI_VOLUME_THRESHOLD = 0.30;
const EAI_REFRACTORY_SECONDS = 15;
const EAI_MIN_BASELINE_BREATHS = 5;

interface BreathMetric {
  time: number;       // seconds from start
  rate: number;       // respiratory rate (breaths/min)
  volume: number;     // tidal volume (integrated inspiratory flow)
}

export function computeEstimatedArousalIndex(
  flowData: Float32Array,
  samplingRate: number
): number {
  // Extract breath-by-breath metrics
  const breathMetrics = extractBreathMetrics(flowData, samplingRate);

  if (breathMetrics.length < 10) {
    return 0;
  }

  const totalDurationSeconds = flowData.length / samplingRate;
  const durationHours = totalDurationSeconds / 3600;
  if (durationHours < 0.01) {
    return 0;
  }

  const arousals: { time: number }[] = [];

  for (let i = 0; i < breathMetrics.length; i++) {
    const current = breathMetrics[i];

    // Compute how many breaths back the 120-second window covers
    const windowBreaths = Math.floor(
      EAI_BASELINE_WINDOW_SECONDS / (60 / current.rate)
    );
    const baselineStart = Math.max(0, i - windowBreaths);
    const baselineMetrics = breathMetrics.slice(baselineStart, i);

    if (baselineMetrics.length < EAI_MIN_BASELINE_BREATHS) continue;

    // Compute baseline averages
    let sumRate = 0;
    let sumVol = 0;
    for (const m of baselineMetrics) {
      sumRate += m.rate;
      sumVol += m.volume;
    }
    const baselineRate = sumRate / baselineMetrics.length;
    const baselineVolume = sumVol / baselineMetrics.length;

    // Check for arousal: rate increase >20% OR volume increase >30%
    const rateIncrease = baselineRate > 0
      ? (current.rate - baselineRate) / baselineRate
      : 0;
    const volumeIncrease = baselineVolume > 0
      ? (current.volume - baselineVolume) / baselineVolume
      : 0;

    if (rateIncrease > EAI_RATE_THRESHOLD || volumeIncrease > EAI_VOLUME_THRESHOLD) {
      // Refractory period: skip if an arousal was detected within 15 seconds
      const recentArousal = arousals.length > 0 &&
        (current.time - arousals[arousals.length - 1].time) < EAI_REFRACTORY_SECONDS;

      if (!recentArousal) {
        arousals.push({ time: current.time });
      }
    }
  }

  return durationHours > 0 ? arousals.length / durationHours : 0;
}

function extractBreathMetrics(
  flowData: Float32Array,
  samplingRate: number
): BreathMetric[] {
  // Find breath boundaries at positive-going zero crossings
  const breathStarts: number[] = [];
  for (let i = 1; i < flowData.length; i++) {
    if (flowData[i] > 0 && flowData[i - 1] <= 0) {
      breathStarts.push(i);
    }
  }

  if (breathStarts.length < 2) return [];

  const metrics: BreathMetric[] = [];

  for (let i = 1; i < breathStarts.length; i++) {
    const start = breathStarts[i - 1];
    const end = breathStarts[i];
    const startTime = start / samplingRate;
    const breathDuration = (end - start) / samplingRate;

    // Skip implausible breaths
    if (breathDuration <= 0 || breathDuration > 20) continue;

    const respiratoryRate = 60 / breathDuration;

    // Tidal volume: integrate inspiratory flow (positive portion)
    // Find inspiration end (negative-going zero crossing within this breath)
    let inspEnd = end;
    for (let j = start + 1; j < end; j++) {
      if (flowData[j] <= 0 && flowData[j - 1] > 0) {
        inspEnd = j;
        break;
      }
    }

    let tidalVolume = 0;
    for (let j = start; j < inspEnd; j++) {
      tidalVolume += Math.abs(flowData[j]) / samplingRate;
    }

    metrics.push({
      time: startTime,
      rate: respiratoryRate,
      volume: tidalVolume,
    });
  }

  return metrics;
}
