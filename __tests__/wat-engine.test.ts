import { describe, it, expect } from 'vitest';
import { computeWAT, computeEstimatedArousalIndex } from '@/lib/analyzers/wat-engine';

// Helper: generate a sine wave (normal breathing)
function makeSineWave(seconds: number, samplingRate = 25): Float32Array {
  const total = seconds * samplingRate;
  const data = new Float32Array(total);
  const breathPeriod = 4 * samplingRate; // 4s per breath
  for (let i = 0; i < total; i++) {
    data[i] = 20 * Math.sin((2 * Math.PI * i) / breathPeriod);
  }
  return data;
}

// Helper: generate flat-topped (flow limited) breathing
function makeFlatWave(seconds: number, samplingRate = 25): Float32Array {
  const total = seconds * samplingRate;
  const data = new Float32Array(total);
  const breathPeriod = 4 * samplingRate;
  for (let i = 0; i < total; i++) {
    const phase = (i % breathPeriod) / breathPeriod;
    if (phase < 0.5) {
      const raw = Math.sin(Math.PI * phase * 2);
      data[i] = 20 * Math.min(raw, 0.5); // clipped
    } else {
      data[i] = -15 * Math.sin(Math.PI * (phase - 0.5) * 2);
    }
  }
  return data;
}

// Helper: generate breathing with periodic arousal events.
// Normal breaths at 4s period (15 bpm), arousal breaths at 2.5s period
// (24 bpm = 60% rate increase) with 1.5x tidal volume.
function makeArousalWave(
  seconds: number,
  arousalEveryNBreaths: number,
  samplingRate = 25
): Float32Array {
  const total = seconds * samplingRate;
  const data = new Float32Array(total);
  const normalPeriod = 4 * samplingRate;  // 4s breath
  const arousalPeriod = 2.5 * samplingRate; // faster breath

  let sampleIdx = 0;
  let breathCount = 0;

  while (sampleIdx < total) {
    const isArousal = breathCount > 0 && breathCount % arousalEveryNBreaths === 0;
    const period = isArousal ? arousalPeriod : normalPeriod;
    const amplitude = isArousal ? 30 : 20; // 1.5x tidal volume boost

    for (let j = 0; j < period && sampleIdx < total; j++, sampleIdx++) {
      data[sampleIdx] = amplitude * Math.sin((2 * Math.PI * j) / period);
    }
    breathCount++;
  }
  return data;
}

describe('WAT Engine', () => {
  it('returns valid scores for normal breathing', () => {
    const data = makeSineWave(300); // 5 minutes
    const result = computeWAT(data, 25);

    expect(result.flScore).toBeGreaterThanOrEqual(0);
    expect(result.flScore).toBeLessThanOrEqual(100);
    expect(result.regularityScore).toBeGreaterThanOrEqual(0);
    expect(result.regularityScore).toBeLessThanOrEqual(100);
    expect(result.periodicityIndex).toBeGreaterThanOrEqual(0);
    expect(result.periodicityIndex).toBeLessThanOrEqual(100);
    expect(result.estimatedArousalIndex).toBeGreaterThanOrEqual(0);
  });

  it('returns zero scores for insufficient data', () => {
    const short = new Float32Array(100);
    const result = computeWAT(short, 25);

    expect(result.flScore).toBe(0);
    expect(result.estimatedArousalIndex).toBe(0);
    expect(result.regularityScore).toBeGreaterThanOrEqual(0);
  });

  it('detects higher FL score in flat-topped vs normal breathing', () => {
    const normal = computeWAT(makeSineWave(300), 25);
    const flat = computeWAT(makeFlatWave(300), 25);

    expect(flat.flScore).toBeGreaterThan(normal.flScore);
  });

  it('returns all-zero for all-zero data', () => {
    const zeros = new Float32Array(10000);
    const result = computeWAT(zeros, 25);

    expect(result.flScore).toBe(0);
    expect(result.estimatedArousalIndex).toBe(0);
  });

  it('regularity score is high for periodic breathing', () => {
    const data = makeSineWave(600);
    const result = computeWAT(data, 25);

    expect(result.regularityScore).toBeGreaterThan(0);
  });
});

describe('Estimated Arousal Index', () => {
  it('returns 0 for uniform breathing', () => {
    // Perfectly regular sine wave — no rate or volume changes
    const data = makeSineWave(600);
    const eai = computeEstimatedArousalIndex(data, 25);

    expect(eai).toBe(0);
  });

  it('detects arousal breaths with rate/volume increases', () => {
    // Arousal every 15 breaths: faster rate + bigger volume
    const data = makeArousalWave(600, 15, 25);
    const eai = computeEstimatedArousalIndex(data, 25);

    expect(eai).toBeGreaterThan(0);
  });

  it('returns higher EAI for more frequent arousal breaths', () => {
    const infrequent = computeEstimatedArousalIndex(makeArousalWave(600, 30, 25), 25);
    const frequent = computeEstimatedArousalIndex(makeArousalWave(600, 10, 25), 25);

    expect(frequent).toBeGreaterThan(infrequent);
  });

  it('returns 0 for very short data', () => {
    const short = new Float32Array(50);
    expect(computeEstimatedArousalIndex(short, 25)).toBe(0);
  });
});
