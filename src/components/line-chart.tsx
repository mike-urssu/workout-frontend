import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { Font } from '@/constants/theme';

export type Series = { color: string; values: number[] };
type Props = { series: Series[]; labels: string[]; intervals: number; plotHeight: number };

const STEPS = [1, 1.5, 2, 2.5, 3, 5, 10];
/** Smallest "nice" axis max (≥ value) split evenly into `intervals`. */
function niceMax(value: number, intervals: number) {
  const raw = Math.max(value, 1) / intervals;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = (STEPS.find((s) => s * mag >= raw) ?? 10) * mag;
  return step * intervals;
}
const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function LineChart({ series, labels, intervals, plotHeight }: Props) {
  const [width, setWidth] = useState(0);
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)), intervals);
  const ticks = Array.from({ length: intervals + 1 }, (_, i) => (max / intervals) * i);
  const y = (v: number) => plotHeight - (v / max) * plotHeight;
  const x = (i: number) => ((i + 0.5) * width) / labels.length;

  return (
    <View style={styles.row}>
      <View style={{ width: 28, height: plotHeight }}>
        {ticks.map((t) => (
          <Text key={t} style={[styles.yLabel, { top: y(t) - 6 }]}>{fmt(t)}</Text>
        ))}
      </View>
      <View style={styles.plot} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <Svg width={width} height={plotHeight + 4}>
          {ticks.map((t) => (
            <Line key={t} x1={0} x2={width} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          ))}
          {series.map((s) => (
            <Polyline
              key={s.color}
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          ))}
          {series.map((s) => s.values.map((v, i) => <Circle key={`${s.color}${i}`} cx={x(i)} cy={y(v)} r={3} fill={s.color} />))}
        </Svg>
        <View style={styles.xRow}>
          {labels.map((l) => (
            <Text key={l} style={styles.xLabel}>{l}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingTop: 6 },
  plot: { flex: 1 },
  yLabel: {
    position: 'absolute',
    right: 0,
    fontFamily: Font.manrope.semibold,
    fontSize: 10,
    color: '#9a9aa6',
  },
  xRow: { flexDirection: 'row', marginTop: 4 },
  xLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Font.inter.regular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },
});
