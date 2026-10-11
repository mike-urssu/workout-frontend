import { useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { StatsExercise, getCategoryTrend, getExerciseTrend, getStatsExercises } from '@/api/stats';
import { Category } from '@/api/workout';
import { LineChart } from '@/components/line-chart';
import { Screen } from '@/components/screen';
import { Font, Palette } from '@/constants/theme';
import { loadCategories, styleOf, useCategories } from '@/hooks/use-categories';
import { errorMessage, notify } from '@/lib/dialog';

// A body part has at most 8 exercises and all of them can be selected, so there are 8 line colours.
const LINE_COLORS = ['#b2e000', '#668aff', '#cc66ff', '#ff9933', '#ff6b8b', '#2ed3b7', '#ffd23f', '#8fa3b8'];
const label = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
const dotted = (date: string) => date.replace(/-/g, '.');
/** The days a chart shows, e.g. 2026.09.22–09.27 (the year again only when it changes); nothing when it shows no day. */
const period = (dates: string[] = []) => {
  if (dates.length === 0) return null;
  const [first, last] = [dates[0], dates[dates.length - 1]];
  if (first === last) return dotted(first);
  return `${dotted(first)}–${dotted(first.slice(0, 4) === last.slice(0, 4) ? last.slice(5) : last)}`;
};

/** One chart's days loaded so far, oldest first; each series' values line up with `dates`. */
type Strip = { dates: string[]; series: { id: string; name: string; values: (number | null)[] }[]; hasPrevious: boolean };
/** The days before `before` (exclusive), or the latest ones. */
type Page = (before?: string) => Promise<Strip>;
/** Older days go in front; a series the older page does not have is empty there. */
const prepend = (older: Strip, strip: Strip): Strip => ({
  dates: [...older.dates, ...strip.dates],
  series: strip.series.map((s) => ({
    ...s,
    values: [...(older.series.find((o) => o.id === s.id)?.values ?? older.dates.map(() => null)), ...s.values],
  })),
  hasPrevious: older.hasPrevious,
});

/**
 * One chart's strip of days and where it is scrolled to. The latest page decides how many days fit on screen
 * (up to 12 within 3 months, BR-004, BR-021); dragging then moves one shown day at a time (BR-016).
 */
function useStrip(guard: (fn: () => Promise<void>) => void) {
  const [view, setView] = useState<{ strip: Strip; visible: number; fromEnd: number; serial: number } | null>(null);

  /** Keep a screenful of older days loaded behind the shown ones, so a drag can slide them in. */
  const fill = async (page: Page, strip: Strip, visible: number, fromEnd: number) => {
    if (!strip.hasPrevious || strip.dates.length - visible - fromEnd >= visible) return;
    const before = strip.dates[0];
    const older = await page(before);
    // dropped when the chart was reloaded meanwhile
    setView((v) => (v && v.strip.dates[0] === before ? { ...v, strip: prepend(older, v.strip) } : v));
  };

  /** The latest days, e.g. for a new selection; null clears the chart. */
  const load = async (page: Page | null) => {
    if (!page) return setView(null);
    const strip = await page();
    setView((v) => ({ strip, visible: strip.dates.length, fromEnd: 0, serial: (v?.serial ?? 0) + 1 }));
    await fill(page, strip, strip.dates.length, 0);
  };

  const move = (page: Page, fromEnd: number) => {
    if (!view) return;
    setView((v) => v && { ...v, fromEnd });
    if (view.strip.hasPrevious && view.strip.dates.length - view.visible - fromEnd < view.visible) {
      guard(() => fill(page, view.strip, view.visible, fromEnd));
    }
  };

  const shownDates = view ? view.strip.dates.slice(view.strip.dates.length - view.visible - view.fromEnd, view.strip.dates.length - view.fromEnd) : [];
  return { view, load, move, shownDates };
}

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

/** The days a chart shows, next to its title (each chart pages on its own, TODO-020). */
function SectionTitle({ title, dates }: { title: string; dates?: string[] }) {
  const range = period(dates);
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{title}</Text>
      {range && <Text style={styles.period}>{range}</Text>}
    </View>
  );
}

export default function StatsScreen() {
  const categories = useCategories();
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
  // Top chart: one body part's volume per day it was trained.
  const [topId, setTopId] = useState<string | null>(null);
  const top = useStrip(guard);
  // Bottom chart: its own body part, its exercises, and the picked ones' volumes on the days they were done (BR-015).
  const [bottomId, setBottomId] = useState<string | null>(null);
  const [exercises, setExercises] = useState<StatsExercise[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const bottom = useStrip(guard);

  const topPage = (id: string): Page => async (before) => {
    const t = await getCategoryTrend(id, before);
    return { dates: t.dates, series: [{ id, name: '', values: t.volumes }], hasPrevious: t.hasPrevious };
  };
  /** The days any of the exercises was done (BR-015); nothing is requested for 0 exercises. */
  const bottomPage = (ids: string[]): Page | null =>
    ids.length
      ? async (before) => {
          const t = await getExerciseTrend(ids, before);
          return { dates: t.dates, series: t.exercises.map((e) => ({ id: e.id, name: e.name, values: e.volumes })), hasPrevious: t.hasPrevious };
        }
      : null;

  /** The exercise list follows the bottom chart's body part, and all its recorded exercises are selected (BR-010, BR-017). */
  const chooseBottom = async (id: string) => {
    setBottomId(id);
    const list = await getStatsExercises(id);
    const ids = list.map((e) => e.id);
    setExercises(list);
    setPicked(ids);
    await bottom.load(bottomPage(ids));
  };

  // Opening the screen always starts from chest in both charts and the latest days.
  useFocusEffect(
    useCallback(() => {
      guard(async () => {
        const chest = (await loadCategories())[0];
        if (!chest) return;
        setTopId(chest.id);
        await top.load(topPage(chest.id));
        await chooseBottom(chest.id);
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  /** Changing the top chart's part starts from its latest days (TODO-014); the exercise chart keeps its own (BR-015). */
  const chooseTop = (id: string) =>
    guard(async () => {
      setTopId(id);
      await top.load(topPage(id));
    });

  /** A new selection has its own days, so it starts again from the latest ones. */
  const toggle = (id: string) => {
    if (loading) return;
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    setPicked(next);
    guard(() => bottom.load(bottomPage(next)));
  };

  const colorOf = (id: string) => LINE_COLORS[Math.max(0, picked.indexOf(id)) % LINE_COLORS.length];
  // The previous response stays on screen until the new one arrives; draw only what is still selected.
  const shown = (bottom.view?.strip.series ?? []).filter((e) => picked.includes(e.id));
  const topCategory = categories.find((c) => c.id === topId);
  const topColor = styleOf(topCategory?.name ?? '')?.color ?? Palette.accent;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>운동 통계</Text>

        <View style={styles.periodControls}>
          <View style={styles.periodHint}>
            <Text style={styles.periodHintText}>최대 3개월 · 최대 12개 지점</Text>
          </View>
          <View style={styles.swipeHint}>
            <View style={styles.swipeIcon}>
              <ChevronLeft size={12} color="rgba(255,255,255,0.4)" />
              <ChevronRight size={12} color="rgba(255,255,255,0.4)" />
            </View>
            <Text style={styles.swipeHintText}>좌우로 밀어 날짜 단위로 이동하면 최대 3개월 범위 안에서 최대 12개 지점으로 추이를 확인할 수 있어요.</Text>
          </View>
        </View>

        <SectionTitle title="부위별 볼륨 추이 (단위: 1,000kg)" dates={top.shownDates} />
        <CategoryChips categories={categories} selected={topId} disabled={loading} onSelect={chooseTop} />
        <View style={styles.card}>
          <LineChart
            key={top.view?.serial}
            series={(top.view?.strip.series ?? []).map((x) => ({ color: topColor, values: x.values }))}
            labels={top.view?.strip.dates.map(label) ?? []}
            visible={top.view?.visible ?? 0}
            fromEnd={top.view?.fromEnd ?? 0}
            onMove={(to) => topId && top.move(topPage(topId), to)}
            name="부위별 볼륨 추이 그래프"
            intervals={4}
            plotHeight={200}
          />
          {top.view && top.view.strip.dates.length === 0 && <Text style={styles.empty}>이 부위의 운동 기록이 없어요</Text>}
          {topCategory && (
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: topColor }]} />
                <Text style={[styles.legendText, { color: topColor }]}>{topCategory.name}</Text>
              </View>
            </View>
          )}
        </View>

        <SectionTitle title="종목별 추이 (단위: 1,000kg)" dates={bottom.shownDates} />
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
            key={bottom.view?.serial}
            series={shown.map((e) => ({ color: colorOf(e.id), values: e.values }))}
            labels={bottom.view?.strip.dates.map(label) ?? []}
            visible={bottom.view?.visible ?? 0}
            fromEnd={bottom.view?.fromEnd ?? 0}
            onMove={(to) => {
              const page = bottomPage(picked);
              if (page) bottom.move(page, to);
            }}
            name="종목별 추이 그래프"
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
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  period: { fontFamily: Font.manrope.semibold, fontSize: 12, color: '#9a9aa6', marginTop: 12 },
  periodControls: { gap: 12, marginTop: 4 },
  periodHint: {
    alignSelf: 'flex-start', backgroundColor: '#26262b', borderWidth: 1, borderColor: Palette.border,
    borderRadius: 100, paddingHorizontal: 10, paddingVertical: 6,
  },
  periodHintText: { fontFamily: Font.manrope.semibold, fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  swipeHint: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swipeIcon: { flexDirection: 'row', gap: 4 },
  swipeHintText: { flex: 1, fontFamily: Font.manrope.regular, fontSize: 12, color: 'rgba(255,255,255,0.4)' },
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
