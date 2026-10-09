import { useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  CategoryTrend, ExerciseTrend, StatsExercise, getCategoryTrend, getExerciseTrend, getStatsExercises,
} from '@/api/stats';
import { LineChart } from '@/components/line-chart';
import { Screen } from '@/components/screen';
import { Font, Palette } from '@/constants/theme';
import { styleOf } from '@/hooks/use-categories';
import { errorMessage, notify } from '@/lib/dialog';

// A body part has at most 8 exercises and all of them can be selected, so there are 8 line colours.
const LINE_COLORS = ['#b2e000', '#668aff', '#cc66ff', '#ff9933', '#ff6b8b', '#2ed3b7', '#ffd23f', '#8fa3b8'];
const label = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

export default function StatsScreen() {
  const [trend, setTrend] = useState<CategoryTrend | null>(null);
  const [newer, setNewer] = useState<CategoryTrend[]>([]); // intervals we paged past, kept for paging back
  const [categoryId, setCategoryId] = useState<string | null>(null);
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

  /** The exercise chart shares the dates of the body-part chart; nothing is requested for 0 exercises. */
  const loadExerciseTrend = async (ids: string[], dates: string[]) =>
    setExTrend(ids.length && dates.length ? await getExerciseTrend(ids, dates) : null);

  /** Picking a body part selects all of its recorded exercises (BR-017). */
  const chooseCategory = async (id: string, dates: string[]) => {
    setCategoryId(id);
    const list = await getStatsExercises(id);
    const ids = list.map((e) => e.id);
    setExercises(list);
    setPicked(ids);
    await loadExerciseTrend(ids, dates);
  };

  // Opening the screen always starts from the latest interval and the default selection.
  useFocusEffect(
    useCallback(() => {
      guard(async () => {
        const t = await getCategoryTrend();
        setTrend(t);
        setNewer([]);
        setExTrend(null);
        setExercises([]);
        setPicked([]);
        if (t.dates.length) await chooseCategory(t.categories[0].id, t.dates);
        else setCategoryId(null);
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const older = () =>
    trend?.hasPrevious && !loading &&
    guard(async () => {
      // before = the latest day shown, so the interval slides back by one day (BR-016)
      const t = await getCategoryTrend(trend.dates[trend.dates.length - 1]);
      setNewer([...newer, trend]);
      setTrend(t);
      await loadExerciseTrend(picked, t.dates);
    });

  const newerInterval = () =>
    newer.length > 0 && !loading &&
    guard(async () => {
      const t = newer[newer.length - 1];
      setNewer(newer.slice(0, -1));
      setTrend(t);
      await loadExerciseTrend(picked, t.dates);
    });

  const toggle = (id: string) => {
    if (loading || !trend) return;
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    setPicked(next);
    guard(() => loadExerciseTrend(next, trend.dates));
  };

  const colorOf = (id: string) => LINE_COLORS[Math.max(0, picked.indexOf(id)) % LINE_COLORS.length];
  // The previous response stays on screen until the new one arrives; draw only what is still selected.
  const shown = (exTrend?.exercises ?? []).filter((e) => picked.includes(e.id));
  const labels = trend?.dates.map(label) ?? [];
  const hasData = !!trend && trend.dates.length > 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: 2 }}>
          <Text style={styles.title}>운동 통계</Text>
          <Text style={styles.subtitle}>부위별·종목별 볼륨 추이</Text>
        </View>

        {trend && !hasData && <Text style={styles.empty}>아직 운동 기록이 없어요</Text>}

        {trend && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.section}>부위별 볼륨 추이 (단위: 1,000kg)</Text>
              <View style={styles.pager}>
                <Pressable style={[styles.pageBtn, !trend.hasPrevious && styles.pageOff]} onPress={older} disabled={!trend.hasPrevious || loading}>
                  <ChevronLeft size={16} color="#fff" />
                </Pressable>
                <Pressable style={[styles.pageBtn, newer.length === 0 && styles.pageOff]} onPress={newerInterval} disabled={newer.length === 0 || loading}>
                  <ChevronRight size={16} color="#fff" />
                </Pressable>
              </View>
            </View>
            <View style={styles.card}>
              <LineChart
                series={trend.categories.map((c) => ({ color: styleOf(c.name)?.color ?? '#fff', values: c.volumes }))}
                labels={labels}
                intervals={4}
                plotHeight={200}
              />
              <View style={styles.legend}>
                {trend.categories.map((c) => {
                  const color = styleOf(c.name)?.color ?? '#fff';
                  return (
                    <View key={c.id} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: color }]} />
                      <Text style={[styles.legendText, { color }]}>{c.name}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <Text style={styles.section}>종목별 추이 (단위: 1,000kg)</Text>
            <View style={styles.chips}>
              {trend.categories.map((c) => {
                const active = c.id === categoryId;
                const color = styleOf(c.name)?.color ?? '#fff';
                return (
                  <Pressable
                    key={c.id}
                    disabled={loading}
                    onPress={() => !active && guard(() => chooseCategory(c.id, trend.dates))}
                    style={[styles.chip, active ? { backgroundColor: '#26262b', borderColor: color } : { borderColor: `${color}4D` }]}>
                    <Text style={[styles.chipText, { color, fontFamily: active ? Font.manrope.bold : Font.manrope.semibold }]}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.chips}>
              {exercises.length === 0 && <Text style={styles.empty}>이 부위에 기록한 운동이 없어요</Text>}
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
                labels={labels}
                intervals={3}
                plotHeight={150}
                compact
              />
              <View style={styles.legend}>
                {shown.map((e) => (
                  <View key={e.id} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colorOf(e.id) }]} />
                    <Text style={[styles.legendText, { color: Palette.muted }]}>{e.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
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
