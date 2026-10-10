import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Font } from '@/constants/theme';

/** null = no workout that day: no dot, the line joins the neighbouring points. */
export type Series = { color: string; values: (number | null)[] };
type Props = {
  series: Series[];
  labels: string[];
  /** How many days fit across the chart; the rest slide in by dragging, one day per slot. */
  visible: number;
  /** Days between the newest one shown and the newest one loaded (0 = the latest days). */
  fromEnd: number;
  /** Called when a drag (or a screen reader adjust) settles on a new position. */
  onMove: (fromEnd: number) => void;
  /** Screen reader name of the chart. */
  name: string;
  intervals: number;
  plotHeight: number;
  compact?: boolean;
};

const SETTLE = { duration: 300, dampingRatio: 1, reduceMotion: ReduceMotion.System };
const FLING = 0.15; // seconds of release velocity carried into the snap, so a flick moves a few days
const STEPS = [1, 1.5, 2, 2.5, 3, 5, 10];
/** Smallest "nice" axis max (≥ value) split evenly into `intervals`. */
function niceMax(value: number, intervals: number) {
  const raw = Math.max(value, 1) / intervals;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = (STEPS.find((s) => s * mag >= raw) ?? 10) * mag;
  return step * intervals;
}
/** Axis labels are in 1,000 kg (the section titles say "단위: 1,000kg"). */
const fmt = (n: number) => (n / 1000).toFixed(1);

/**
 * Line chart over a strip of days, oldest first. `visible` slots are on screen, anchored to the right;
 * dragging right slides older days in and snaps to whole slots.
 */
export function LineChart({ series, labels, visible, fromEnd, onMove, name, intervals, plotHeight, compact }: Props) {
  const [width, setWidth] = useState(0);
  const total = labels.length;
  const shown = Math.max(1, Math.min(visible, total));
  const last = Math.max(0, total - shown); // the furthest fromEnd
  const slot = width / shown;
  // The y axis fits the days on screen.
  const end = total - fromEnd;
  const onScreen = series.flatMap((s) => s.values.slice(end - shown, end).filter((v): v is number => v !== null));
  const max = niceMax(Math.max(0, ...onScreen), intervals);
  const ticks = Array.from({ length: intervals + 1 }, (_, i) => (max / intervals) * i);
  const y = (v: number) => plotHeight - (v / max) * plotHeight;
  const x = (i: number) => (i + 0.5) * slot;
  // Up to 12 days do not fit side by side: label every `step`-th day counted back from the newest one.
  const step = Math.ceil(shown / 6);

  // px the strip is dragged right of the latest days. Older days are added on the left, so this stays put.
  const shift = useSharedValue(0);
  const from = useSharedValue(0);
  useEffect(() => {
    shift.set(withSpring(fromEnd * slot, SETTLE));
  }, [fromEnd, slot, shift]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-10, 10])
        .onStart(() => from.set(shift.get()))
        .onUpdate((e) => shift.set(Math.min(Math.max(from.get() + e.translationX, 0), last * slot)))
        .onEnd((e) => {
          const to = slot ? Math.min(Math.max(Math.round((shift.get() + e.velocityX * FLING) / slot), 0), last) : 0;
          if (to === fromEnd) shift.set(withSpring(to * slot, SETTLE));
          scheduleOnRN(onMove, to);
        }),
    [fromEnd, last, slot, onMove, shift, from],
  );
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: shift.get() }] }));

  return (
    <View style={styles.row}>
      <View style={{ width: 28, height: plotHeight }}>
        {ticks.map((t) => (
          <Text key={t} style={[styles.yLabel, compact && styles.yLabelCompact, { top: y(t) - 6 }]}>{fmt(t)}</Text>
        ))}
      </View>
      <GestureDetector gesture={pan}>
        <View
          style={[styles.plot, { height: plotHeight + 26 }]}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={name}
          accessibilityActions={[{ name: 'decrement', label: '이전 날짜' }, { name: 'increment', label: '다음 날짜' }]}
          onAccessibilityAction={(e) =>
            onMove(e.nativeEvent.actionName === 'decrement' ? Math.min(fromEnd + 1, last) : Math.max(fromEnd - 1, 0))
          }>
          <Svg width={width} height={plotHeight + 4} style={StyleSheet.absoluteFill}>
            {ticks.map((t) => (
              <Line key={t} x1={0} x2={width} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            ))}
          </Svg>
          <Animated.View style={[styles.strip, { left: width - total * slot, width: total * slot }, slide]}>
            <Svg width={total * slot} height={plotHeight + 4}>
              {series.map((s, si) => (
                <Polyline
                  key={si}
                  points={s.values.flatMap((v, i) => (v === null ? [] : [`${x(i)},${y(v)}`])).join(' ')}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              ))}
              {series.map((s, si) => s.values.map((v, i) => v === null ? null : <Circle key={`${si}-${i}`} cx={x(i)} cy={y(v)} r={3} fill={s.color} />))}
            </Svg>
            <View style={styles.xRow}>
              {labels.map((l, i) => (
                <Text key={i} style={styles.xLabel}>{(total - 1 - i) % step === 0 ? l : ''}</Text>
              ))}
            </View>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingTop: 6 },
  plot: { flex: 1, overflow: 'hidden' },
  strip: { position: 'absolute', top: 0 },
  yLabel: {
    position: 'absolute',
    right: 0,
    fontFamily: Font.manrope.semibold,
    fontSize: 10,
    color: '#9a9aa6',
  },
  yLabelCompact: { fontFamily: Font.inter.regular, fontSize: 9, color: 'rgba(255,255,255,0.35)' },
  xRow: { flexDirection: 'row', marginTop: 4 },
  xLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Font.inter.regular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },
});
