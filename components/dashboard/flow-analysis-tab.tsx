'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/common/metric-card';
import { useThresholds } from '@/components/common/thresholds-provider';
import type { NightResult } from '@/lib/types';
import { BarChart3 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface Props {
  selectedNight: NightResult;
  previousNight: NightResult | null;
  nights: NightResult[];
}

type WATMetricKey = 'flScore' | 'regularityScore' | 'periodicityIndex' | 'estimatedArousalIndex';

const WAT_CHART_CONFIG: Record<WATMetricKey, { label: string; color: string; threshold: number }> = {
  flScore: { label: 'FL Score', color: 'hsl(213 94% 56%)', threshold: 30 },
  regularityScore: { label: 'Regularity', color: 'hsl(38 92% 50%)', threshold: 40 },
  periodicityIndex: { label: 'Periodicity', color: 'hsl(142 71% 45%)', threshold: 20 },
  estimatedArousalIndex: { label: 'EAI', color: 'hsl(0 84% 60%)', threshold: 70 },
};

function WATMiniChart({ nights, metricKey }: { nights: NightResult[]; metricKey: WATMetricKey }) {
  const config = WAT_CHART_CONFIG[metricKey];
  const data = useMemo(
    () =>
      [...nights].reverse().map((n) => ({
        date: n.dateStr.slice(5),
        value: +n.wat[metricKey].toFixed(1),
      })),
    [nights, metricKey]
  );

  return (
    <div className="mt-2 h-[120px] w-full rounded-lg border border-border/30 bg-card/30 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 15% / 0.3)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: 'hsl(215 20% 55%)', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'hsl(215 20% 55%)', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(217 33% 8%)',
              border: '1px solid hsl(217 33% 15%)',
              borderRadius: '0.5rem',
              fontSize: 11,
              color: 'hsl(210 40% 93%)',
            }}
            formatter={(value) => [String(value), config.label]}
          />
          <ReferenceLine
            y={config.threshold}
            stroke={config.color}
            strokeDasharray="4 4"
            strokeWidth={0.5}
            strokeOpacity={0.5}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={config.color}
            strokeWidth={2}
            dot={{ r: 3, fill: config.color }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FlowAnalysisTab({ selectedNight, previousNight, nights }: Props) {
  const THRESHOLDS = useThresholds();
  const n = selectedNight;
  const p = previousNight;
  const [expandedCharts, setExpandedCharts] = useState<Record<WATMetricKey, boolean>>({
    flScore: false,
    regularityScore: false,
    periodicityIndex: false,
    estimatedArousalIndex: false,
  });

  const toggleChart = (key: WATMetricKey) => {
    setExpandedCharts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const hasMultipleNights = nights.length > 1;

  return (
    <div className="flex flex-col gap-6">
      {/* WAT Section */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
          Wobble Analysis Tool (WAT)
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <MetricCard
              label="FL Score"
              value={n.wat.flScore}
              unit="%"
              format="pct"
              threshold={THRESHOLDS.watFL}
              previousValue={p?.wat.flScore}
            />
            {hasMultipleNights && (
              <button
                onClick={() => toggleChart('flScore')}
                aria-pressed={expandedCharts.flScore}
                aria-label="Toggle FL Score trend chart"
                className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <BarChart3 className="h-3 w-3" />
                Trend
              </button>
            )}
            {expandedCharts.flScore && <WATMiniChart nights={nights} metricKey="flScore" />}
          </div>
          <div>
            <MetricCard
              label="Regularity Score"
              value={n.wat.regularityScore}
              unit="%"
              format="int"
              threshold={THRESHOLDS.watRegularity}
              previousValue={p?.wat.regularityScore}
            />
            {hasMultipleNights && (
              <button
                onClick={() => toggleChart('regularityScore')}
                aria-pressed={expandedCharts.regularityScore}
                aria-label="Toggle Regularity Score trend chart"
                className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <BarChart3 className="h-3 w-3" />
                Trend
              </button>
            )}
            {expandedCharts.regularityScore && <WATMiniChart nights={nights} metricKey="regularityScore" />}
          </div>
          <div>
            <MetricCard
              label="Periodicity Index"
              value={n.wat.periodicityIndex}
              unit="%"
              format="pct"
              threshold={THRESHOLDS.watPeriodicity}
              previousValue={p?.wat.periodicityIndex}
            />
            {hasMultipleNights && (
              <button
                onClick={() => toggleChart('periodicityIndex')}
                aria-pressed={expandedCharts.periodicityIndex}
                aria-label="Toggle Periodicity Index trend chart"
                className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <BarChart3 className="h-3 w-3" />
                Trend
              </button>
            )}
            {expandedCharts.periodicityIndex && <WATMiniChart nights={nights} metricKey="periodicityIndex" />}
          </div>
          <div>
            <MetricCard
              label="Est. Arousal Index"
              value={n.wat.estimatedArousalIndex}
              unit="/hr"
              threshold={THRESHOLDS.watEAI}
              previousValue={p?.wat.estimatedArousalIndex}
            />
            {hasMultipleNights && (
              <button
                onClick={() => toggleChart('estimatedArousalIndex')}
                aria-pressed={expandedCharts.estimatedArousalIndex}
                aria-label="Toggle Estimated Arousal Index trend chart"
                className="mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <BarChart3 className="h-3 w-3" />
                Trend
              </button>
            )}
            {expandedCharts.estimatedArousalIndex && <WATMiniChart nights={nights} metricKey="estimatedArousalIndex" />}
          </div>
        </div>
        <Card className="mt-3 border-border/50">
          <CardContent className="py-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground">FL Score</strong> measures the median
              tidal volume ratio — higher values indicate greater flow limitation.{' '}
              <strong className="text-foreground">Regularity</strong> uses Sample Entropy
              to quantify breathing pattern consistency — higher = more regular = worse
              (locked-in pathological patterns).{' '}
              <strong className="text-foreground">Periodicity</strong> uses FFT on minute
              ventilation to detect cyclic breathing patterns.{' '}
              <strong className="text-foreground">EAI</strong> detects recovery breaths
              (2x running baseline) as a proxy for cortical arousals — the best single
              predictor of acute suffering in UARS.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* NED Section */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
          Negative Effort Dependence (NED)
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="NED Mean"
            value={n.ned.nedMean}
            unit="%"
            format="pct"
            threshold={THRESHOLDS.nedMean}
            previousValue={p?.ned.nedMean}
          />
          <MetricCard
            label="NED P95"
            value={n.ned.nedP95}
            unit="%"
            format="pct"
            threshold={THRESHOLDS.nedP95}
            previousValue={p?.ned.nedP95}
          />
          <MetricCard
            label="RERA Index"
            value={n.ned.reraIndex}
            unit="/hr"
            threshold={THRESHOLDS.reraIndex}
            previousValue={p?.ned.reraIndex}
          />
          <MetricCard
            label="RERA Count"
            value={n.ned.reraCount}
            format="int"
            previousValue={p?.ned.reraCount}
          />
        </div>
      </div>

      {/* NED Detail Metrics */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">NED Detail Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Clear FL"
              value={n.ned.nedClearFLPct}
              unit="%"
              format="pct"
              threshold={THRESHOLDS.nedClearFL}
              previousValue={p?.ned.nedClearFLPct}
              compact
            />
            <MetricCard
              label="Borderline FL"
              value={n.ned.nedBorderlinePct}
              unit="%"
              format="pct"
              previousValue={p?.ned.nedBorderlinePct}
              compact
            />
            <MetricCard
              label="Flatness Index"
              value={n.ned.fiMean}
              format="pct"
              previousValue={p?.ned.fiMean}
              compact
            />
            <MetricCard
              label="FI > 0.85"
              value={n.ned.fiFL85Pct}
              unit="%"
              format="pct"
              previousValue={p?.ned.fiFL85Pct}
              compact
            />
            <MetricCard
              label="M-Shape"
              value={n.ned.mShapePct}
              unit="%"
              format="pct"
              previousValue={p?.ned.mShapePct}
              compact
            />
            <MetricCard
              label="Tpeak/Ti Mean"
              value={n.ned.tpeakMean}
              format="pct"
              previousValue={p?.ned.tpeakMean}
              compact
            />
          </div>
        </CardContent>
      </Card>

      {/* H1/H2 Comparison */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            First Half vs Second Half
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                First Half (H1)
              </div>
              <div className="flex items-center justify-between rounded-lg bg-card/50 px-3 py-2.5">
                <span className="text-xs text-muted-foreground">NED Mean</span>
                <span className="font-mono text-lg font-semibold tabular-nums">
                  {n.ned.h1NedMean.toFixed(1)}%
                </span>
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Second Half (H2)
              </div>
              <div className="flex items-center justify-between rounded-lg bg-card/50 px-3 py-2.5">
                <span className="text-xs text-muted-foreground">NED Mean</span>
                <span className="font-mono text-lg font-semibold tabular-nums">
                  {n.ned.h2NedMean.toFixed(1)}%
                </span>
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                H2 – H1 Delta
              </div>
              {(() => {
                const delta = n.ned.h2NedMean - n.ned.h1NedMean;
                const isWorse = delta > 2;
                const isBetter = delta < -2;
                return (
                  <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                    isWorse ? 'bg-red-500/10' : isBetter ? 'bg-emerald-500/10' : 'bg-card/50'
                  }`}>
                    <span className="text-xs text-muted-foreground">
                      {isWorse ? 'Worsening' : isBetter ? 'Improving' : 'Stable'}
                    </span>
                    <span className={`font-mono text-lg font-semibold tabular-nums ${
                      isWorse ? 'text-red-400' : isBetter ? 'text-emerald-400' : 'text-muted-foreground'
                    }`}>
                      {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/70">
            REM-predominant flow limitation typically worsens in H2 as REM density increases.
            A significant H2 rise (&gt;3%) may indicate positional or REM-related obstruction.
          </p>
        </CardContent>
      </Card>

      {/* Breath Stats */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-card/50 px-4 py-3 text-xs text-muted-foreground sm:gap-4">
        <span>
          Total breaths: <strong className="text-foreground">{n.ned.breathCount}</strong>
        </span>
        <span>
          Combined FL:{' '}
          <strong className="text-foreground">{n.ned.combinedFLPct.toFixed(0)}%</strong>
        </span>
      </div>
    </div>
  );
}
