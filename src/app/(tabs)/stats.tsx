import { useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  CategoryTrend, ExerciseTrend, StatsExercise, getCategoryTrend, getExerciseTrend, getStatsExercises,
} from '@/api/stats';
import { Category } from '@/api/workout';
import { LineChart } from '@/components/line-chart';
import { Screen } from '@/components/screen';
import { Font, Palette } from '@/constants/theme';
import { loadCategories, styleOf, useCategories } from '@/hooks/use-categories';
import { errorMessage, notify } from '@/lib/dialog';

// A body part has at most 8 exercises and all of them can be selected, so there are 8 line colours.
const LINE_COLORS = ['#b2e000', '#668aff', '#cc66ff', '#ff9933', '#ff6b8b', '#2ed3b7', '#ffd23f', '#8fa3b8'];
const label = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/** Single-select body-part chips (both charts have their own). */
function CategoryChips({ categories, selected, disabled, onSelect }: {
  categories: Category[]; selected: string | null; disabled: boolean; onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {categories.map((c) => {
        const active = c.id === selected;
        const color = styleOf(c.name)?.color ?? '#fff';
        return (
          <Pressable
            key={c.id}
            disabled={disabled}
            onPress={() => !active && onSelect(c.id)}
            style={[styles.chip, active ? { backgroundColor: '#26262b', borderColor: color } : { borderColor: `${color}4D` }]}>
            <Text style={[styles.chipText, { color, fontFamily: active ? Font.manrope.bold : Font.manrope.semibold }]}>{c.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** ‹ pages to older days, › back to the newer ones already seen (BR-016, design DEC-STATS-003). */
function Pager({ canOlder, canNewer, disabled, onOlder, onNewer }: {
  canOlder: boolean; canNewer: boolean; disabled: boolean; onOlder: () => void; onNewer: () => void;
}) {
  return (
    <View style={styles.pager}>
      <Pressable accessibilityLabel="이전 날짜" style={[styles.pageBtn, !canOlder && styles.pageOff]} onPress={onOlder} disabled={!canOlder || disabled}>
        <ChevronLeft size={16} color="#fff" />
      </Pressable>
      <Pressable accessibilityLabel="다음 날짜" style={[styles.pageBtn, !canNewer && styles.pageOff]} onPress={onNewer} disabled={!canNewer || disabled}>
        <ChevronRight size={16} color="#fff" />
      </Pressable>
    </View>
  );
}

export default function StatsScreen() {
  const categories = useCategories();
  // Top chart: one body part's volume per day it was trained.
  const [topId, setTopId] = useState<string | null>(null);
  const [trend, setTrend] = useState<CategoryTrend | null>(null);
  const [newer, setNewer] = useState<CategoryTrend[]>([]); // intervals we paged past, kept for paging back
  // Bottom chart: its own body part, the days that part was trained (BR-015), its exercises and their volumes on those days.
  const [bottomId, setBottomId] = useState<string | null>(null);
  const [axis, setAxis] = useState<CategoryTrend | null>(null);
  const [axisNewer, setAxisNewer] = useState<CategoryTrend[]>([]);
  const [exercises, setExercises] = useState<StatsExercise[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [exTrend, setExTrend] = useState<ExerciseTrend | null>(null);
  const [loading, setLoading] = useState(false);

  const guard = async (fn: () => Promise<void>) => {
    setLoading(true);
    try {
      await fn();
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  /** Nothing is requested for 0 exercises or no days. */
  const loadExerciseTrend = async (ids: string[], dates: string[]) =>
    setExTrend(ids.length && dates.length ? await getExerciseTrend(ids, dates) : null);

  /**
   * The exercise list follows the bottom chart's body part, and all its recorded exercises are selected (BR-010, BR-017).
   * Its axis is the days that part was trained, from the same API as the top chart (BR-015, design DEC-STATS-012).
   */
  const chooseBottom = async (id: string, days?: CategoryTrend) => {
    setBottomId(id);
    const [list, a] = await Promise.all([getStatsExercises(id), days ?? getCategoryTrend(id)]);
    const ids = list.map((e) => e.id);
    setExercises(list);
    setPicked(ids);
    setAxis(a);
    setAxisNewer([]);
    await loadExerciseTrend(ids, a.dates);
  };

  // Opening the screen always starts from chest in both charts and the latest interval.
  useFocusEffect(
    useCallback(() => {
      guard(async () => {
        const chest = (await loadCategories())[0];
        if (!chest) return;
        setTopId(chest.id);
        const t = await getCategoryTrend(chest.id);
        setTrend(t);
        setNewer([]);
        setExTrend(null);
        await chooseBottom(chest.id, t); // both charts start on chest: one response serves both
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  /** Changing the top chart's part starts from its latest interval (TODO-014); the exercise chart keeps its own days (BR-015). */
  const chooseTop = (id: string) =>
    guard(async () => {
      const t = await getCategoryTrend(id);
      setTopId(id);
      setTrend(t);
      setNewer([]);
    });

  const older = () =>
    trend?.hasPrevious && topId && !loading &&
    guard(async () => {
      // before = the latest day shown, so the interval slides back by one day (BR-016)
      const t = await getCategoryTrend(topId, trend.dates[trend.dates.length - 1]);
      setNewer([...newer, trend]);
      setTrend(t);
    });

  const newerInterval = () => {
    if (newer.length === 0 || loading) return;
    setTrend(newer[newer.length - 1]);
    setNewer(newer.slice(0, -1));
  };

  /** The exercise chart pages through its own part's days, keeping the selected exercises (BR-015, BR-016). */
  const olderAxis = () =>
    axis?.hasPrevious && bottomId && !loading &&
    guard(async () => {
      const a = await getCategoryTrend(bottomId, axis.dates[axis.dates.length - 1]);
      setAxisNewer([...axisNewer, axis]);
      setAxis(a);
      await loadExerciseTrend(picked, a.dates);
    });

  const newerAxis = () =>
    axisNewer.length > 0 && !loading &&
    guard(async () => {
      const a = axisNewer[axisNewer.length - 1];
      setAxisNewer(axisNewer.slice(0, -1));
      setAxis(a);
      await loadExerciseTrend(picked, a.dates);
    });

  const toggle = (id: string) => {
    if (loading || !axis) return;
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    setPicked(next);
    guard(() => loadExerciseTrend(next, axis.dates));
  };

  const colorOf = (id: string) => LINE_COLORS[Math.max(0, picked.indexOf(id)) % LINE_COLORS.length];
  // The previous response stays on screen until the new one arrives; draw only what is still selected.
  const shown = (exTrend?.exercises ?? []).filter((e) => picked.includes(e.id));
  const labels = trend?.dates.map(label) ?? [];
  const topCategory = categories.find((c) => c.id === topId);
  const topColor = styleOf(topCategory?.name ?? '')?.color ?? Palette.accent;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: 2 }}>
          <Text style={styles.title}>운동 통계</Text>
          <Text style={styles.subtitle}>부위별, 종목별 볼륨 추이</Text>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.section}>부위별 볼륨 추이 (단위: 1,000kg)</Text>
          <Pager canOlder={!!trend?.hasPrevious} canNewer={newer.length > 0} disabled={loading} onOlder={older} onNewer={newerInterval} />
        </View>
        <CategoryChips categories={categories} selected={topId} disabled={loading} onSelect={chooseTop} />
        <View style={styles.card}>
          <LineChart
            series={trend && trend.dates.length ? [{ color: topColor, values: trend.volumes }] : []}
            labels={labels}
            intervals={4}
            plotHeight={200}
          />
          {trend && trend.dates.length === 0 && <Text style={styles.empty}>이 부위의 운동 기록이 없어요</Text>}
          {topCategory && (
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: topColor }]} />
                <Text style={[styles.legendText, { color: topColor }]}>{topCategory.name}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.section}>종목별 추이 (단위: 1,000kg)</Text>
          <Pager canOlder={!!axis?.hasPrevious} canNewer={axisNewer.length > 0} disabled={loading} onOlder={olderAxis} onNewer={newerAxis} />
        </View>
        <CategoryChips
          categories={categories}
          selected={bottomId}
          disabled={loading}
          onSelect={(id) => guard(() => chooseBottom(id))}
        />
        <View style={styles.chips}>
          {bottomId && exercises.length === 0 && !loading && <Text style={styles.empty}>이 부위에 기록한 운동이 없어요</Text>}
          {exercises.map((ex) => {
            const on = picked.includes(ex.id);
            return (
              <Pressable
                key={ex.id}
                disabled={loading}
                onPress={() => toggle(ex.id)}
                style={[styles.chip, on ? { backgroundColor: '#26262b', borderColor: colorOf(ex.id) } : { borderColor: Palette.border }]}>
                <Text style={[styles.chipText, on ? { color: colorOf(ex.id), fontFamily: Font.manrope.bold } : { color: Palette.muted }]}>{ex.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.card}>
          <LineChart
            series={shown.map((e) => ({ color: colorOf(e.id), values: e.volumes }))}
            labels={axis?.dates.map(label) ?? []}
            intervals={3}
            plotHeight={150}
            compact
          />
          <View style={styles.legend}>
            {shown.map((e) => (
              <View key={e.id} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colorOf(e.id) }]} />
                <Text style={[styles.legendText, { color: colorOf(e.id) }]}>{e.name}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingVertical: 16, paddingBottom: 32, gap: 12 },
  title: { fontFamily: Font.outfit.bold, fontSize: 22, color: '#fff' },
  subtitle: { fontFamily: Font.manrope.regular, fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  pager: { flexDirection: 'row', gap: 8 },
  pageBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#26262b', borderWidth: 1,
    borderColor: Palette.border, alignItems: 'center', justifyContent: 'center',
  },
  pageOff: { opacity: 0.3 },
  section: { fontFamily: Font.outfit.bold, fontSize: 16, color: '#fff', marginTop: 12 },
  card: { backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, borderRadius: 20, padding: 16, gap: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: Font.manrope.semibold, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, borderWidth: 1, backgroundColor: Palette.bg },
  chipText: { fontSize: 12 },
  empty: { fontFamily: Font.manrope.regular, fontSize: 13, color: Palette.dim },
});
