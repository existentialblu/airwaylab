'use client';

import { memo, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { NightResult } from '@/lib/types';

interface Props {
  nights: NightResult[];
  therapyChangeDate: string | null;
}

interface MetricDef {
  key: string;
  label: string;
  color: string;
  threshold: number;
  thresholdLabel: string;
  unit: string;
  yDomain: [number, number];
  getValue: (n: NightResult) => number;
  formatValue: (v: number) => string;
}

const METRIC_CHARTS: MetricDef[] = [
  {
    key: 'glasgow',
    label: 'Glasgow Index',
    color: 'hsl(213 94% 56%)',
    threshold: 2.0,
    thresholdLabel: 'Threshold = 2.0',
    unit: '',
    yDomain: [0, 5],
    getValue: (n) => +n.glasgow.overall.toFixed(2),
    formatValue: (v) => v.toFixed(1),
  },
  {
    key: 'flScore',
    label: 'FL Score',
    color: 'hsl(142 71% 45%)',
    threshold: 30,
    thresholdLabel: 'Threshold = 30%',
    unit: '%',
    yDomain: [0, 100],
    getValue: (n) => +n.wat.flScore.toFixed(1),
    formatValue: (v) => v.toFixed(0) + '%',
  },
  {
    key: 'nedMean',
    label: 'NED Mean',
    color: 'hsl(38 92% 50%)',
    threshold: 15,
    thresholdLabel: 'Threshold = 15%',
    unit: '%',
    yDomain: [0, 60],
    getValue: (n) => +n.ned.nedMean.toFixed(1),
    formatValue: (v) => v.toFixed(1) + '%',
  },
  {
    key: 'reraIndex',
    label: 'RERA Index',
    color: 'hsl(0 84% 60%)',
    threshold: 5,
    thresholdLabel: 'Threshold = 5/hr',
    unit: '/hr',
    yDomain: [0, 25],
    getValue: (n) => +n.ned.reraIndex.toFixed(1),
    formatValue: (v) => v.toFixed(1),
  },
  {
    key: 'eai',
    label: 'Est. Arousal Index',
    color: 'hsl(280 70% 55%)',
    threshold: 70,
    thresholdLabel: 'Threshold = 70/hr',
    unit: '/hr',
    yDomain: [0, 300],
    getValue: (n) => +n.wat.estimatedArousalIndex.toFixed(1),
    formatValue: (v) => v.toFixed(0),
  },
  {
    key: 'regularity',
    label: 'Regularity Score',
    color: 'hsl(25 95% 53%)',
    threshold: 40,
    thresholdLabel: 'Threshold = 40%',
    unit: '%',
    yDomain: [0, 100],
    getValue: (n) => +n.wat.regularityScore.toFixed(0),
    formatValue: (v) => v.toFixed(0) + '%',
  },
  {
    key: 'periodicity',
    label: 'Periodicity Index',
    color: 'hsl(170 70% 45%)',
    threshold: 20,
    thresholdLabel: 'Threshold = 20%',
    unit: '%',
    yDomain: [0, 100],
    getValue: (n) => +n.wat.periodicityIndex.toFixed(1),
    formatValue: (v) => v.toFixed(1) + '%',
  },
];

function SingleMetricChart({
  metric,
  nights,
  therapyChangeDate,
}: {
  metric: MetricDef;
  nights: NightResult[];
  therapyChangeDate: string | null;
}) {
  const data = useMemo(() => {
    const raw = [...nights].reverse().map((n) => ({
      date: n.dateStr.slice(5),
      fullDate: n.dateStr,
      value: metric.getValue(n),
      avg7: 0 as number | undefined,
    }));

    // 7-day rolling average (centered where possible, trailing at edges)
    const WINDOW = 7;
    if (raw.length >= WINDOW) {
      for (let i = 0; i < raw.length; i++) {
        const start = Math.max(0, i - WINDOW + 1);
        const slice = raw.slice(start, i + 1);
        raw[i].avg7 = +(slice.reduce((s, d) => s + d.value, 0) / slice.length).toFixed(2);
      }
    } else {
      // Not enough data for rolling average — hide the line
      for (const d of raw) d.avg7 = undefined;
    }

    return raw;
  }, [nights, metric]);

  const hasAvg = data.some((d) => d.avg7 !== undefined);

  const dateToFullDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of data) map.set(d.date, d.fullDate);
    return map;
  }, [data]);

  const therapyChangeDateShort = therapyChangeDate?.slice(5);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: metric.color }}
          />
          <CardTitle className="text-xs font-medium">{metric.label}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="relative h-[180px] w-full">
          <span className="pointer-events-none absolute bottom-0 right-1 z-10 select-none text-[8px] text-muted-foreground/20">
            airwaylab.app
          </span>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(217 33% 15% / 0.3)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: 'hsl(215 20% 55%)', fontSize: 9 }}
                axisLine={{ stroke: 'hsl(217 33% 15%)' }}
                tickLine={false}
              />
              <YAxis
                domain={metric.yDomain}
                tick={{ fill: 'hsl(215 20% 55%)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(217 33% 8%)',
                  border: '1px solid hsl(217 33% 15%)',
                  borderRadius: '0.5rem',
                  fontSize: 11,
                  color: 'hsl(210 40% 93%)',
                }}
                labelFormatter={(label) => dateToFullDate.get(label as string) ?? label}
                formatter={(value, name) => [
                  metric.formatValue(value as number),
                  name as string,
                ]}
              />
              {/* Therapy change reference line */}
              {therapyChangeDateShort && (
                <ReferenceLine
                  x={therapyChangeDateShort}
                  stroke="hsl(38 92% 50%)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{
                    value: 'Settings',
                    fill: 'hsl(38 92% 50%)',
                    fontSize: 9,
                    position: 'top',
                  }}
                />
              )}
              {/* Threshold line */}
              <ReferenceLine
                y={metric.threshold}
                stroke={metric.color}
                strokeDasharray="8 4"
                strokeWidth={0.5}
                strokeOpacity={0.5}
                label={{
                  value: metric.thresholdLabel,
                  fill: 'hsl(215 20% 45%)',
                  fontSize: 8,
                  position: 'right',
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                name="Nightly"
                stroke={metric.color}
                strokeWidth={1.5}
                strokeOpacity={0.4}
                dot={false}
                activeDot={{ r: 4, fill: metric.color }}
              />
              {hasAvg && (
                <Line
                  type="monotone"
                  dataKey="avg7"
                  name="7-night avg"
                  stroke={metric.color}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, fill: metric.color, stroke: 'hsl(217 33% 8%)', strokeWidth: 2 }}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export const TrendChart = memo(function TrendChart({ nights, therapyChangeDate }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium text-muted-foreground">Multi-Night Trends</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {METRIC_CHARTS.map((metric) => (
          <SingleMetricChart
            key={metric.key}
            metric={metric}
            nights={nights}
            therapyChangeDate={therapyChangeDate}
          />
        ))}
      </div>
    </div>
  );
});
