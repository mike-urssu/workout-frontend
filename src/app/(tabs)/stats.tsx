import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LineChart } from '@/components/line-chart';
import { Screen } from '@/components/screen';
import { Font, Palette } from '@/constants/theme';
import { GROUPS, MuscleGroupId, exerciseById, exercisesOf } from '@/data/catalog';
import { Session, dateKey, doneSets, exerciseVolume, groupOf } from '@/data/workout';
import { useWorkoutData } from '@/hooks/use-workout-data';

const DAYS = 6;
const LINE_COLORS = ['#b2e000', '#668aff', '#cc66ff', '#ff9933'];

export default function StatsScreen() {
  const { history } = useWorkoutData();
  const [group, setGroup] = useState<MuscleGroupId>('chest');
  const [picked, setPicked] = useState<string[] | null>(null);
  const [today] = useState(() => Date.now());

  // The chart window ends on the latest recorded day, so dummy/old data still shows up.
  const latest = history.reduce((m, s) => Math.max(m, s.startedAt), 0);
  const endDate = new Date(latest || today);
  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - (DAYS - 1 - i));
    return { key: dateKey(d.getTime()), label: `${d.getMonth() + 1}/${d.getDate()}` };
  });
  const sessionsOn = (key: string): Session[] => history.filter((s) => dateKey(s.startedAt) === key);
  const labels = days.map((d) => d.label);

  const groupSeries = GROUPS.map((g) => ({
    color: g.color,
    values: days.map((d) =>
      sessionsOn(d.key).flatMap((s) => s.exercises).filter((e) => groupOf(e) === g.id)
        .reduce((sum, e) => sum + exerciseVolume(e), 0)),
  }));

  // Exercises of the chosen group that have ever been recorded.
  const recorded = exercisesOf(group).filter((ex) =>
    history.some((s) => s.exercises.some((e) => e.exerciseId === ex.id && doneSets(e).length)));
  const selected = (picked ?? recorded.slice(0, 2).map((e) => e.id)).filter((id) => recorded.some((r) => r.id === id));
  const colorOf = (id: string) => LINE_COLORS[selected.indexOf(id) % LINE_COLORS.length];
  const exerciseSeries = selected.map((id) => ({
    color: colorOf(id),
    values: days.map((d) =>
      sessionsOn(d.key).flatMap((s) => s.exercises).filter((e) => e.exerciseId === id)
        .reduce((sum, e) => sum + exerciseVolume(e), 0)),
  }));

  const toggle = (id: string) =>
    setPicked(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: 2 }}>
          <Text style={styles.title}>운동 통계</Text>
          <Text style={styles.subtitle}>부위별·종목별 주간 볼륨 추이</Text>
        </View>

        <Text style={styles.section}>부위별 볼륨 추이</Text>
        <View style={styles.card}>
          <LineChart series={groupSeries} labels={labels} intervals={4} plotHeight={200} />
          <View style={styles.legend}>
            {GROUPS.map((g) => (
              <View key={g.id} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: g.color }]} />
                <Text style={[styles.legendText, { color: g.color }]}>{g.name}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.section}>종목별 추이</Text>
        <View style={styles.chips}>
          {GROUPS.map((g) => {
            const active = g.id === group;
            return (
              <Pressable
                key={g.id}
                onPress={() => { setGroup(g.id); setPicked(null); }}
                style={[styles.chip, active ? { backgroundColor: '#26262b', borderColor: g.color } : { borderColor: `${g.color}4D` }]}>
                <Text style={[styles.chipText, { color: g.color, fontFamily: active ? Font.manrope.bold : Font.manrope.semibold }]}>{g.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.chips}>
          {recorded.length === 0 && <Text style={styles.empty}>기록된 종목이 없어요</Text>}
          {recorded.map((ex) => {
            const on = selected.includes(ex.id);
            return (
              <Pressable
                key={ex.id}
                onPress={() => toggle(ex.id)}
                style={[styles.chip, on ? { backgroundColor: '#26262b', borderColor: colorOf(ex.id) } : { borderColor: Palette.border }]}>
                <Text style={[styles.chipText, on ? { color: colorOf(ex.id), fontFamily: Font.manrope.bold } : { color: Palette.muted }]}>{ex.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.card}>
          <LineChart series={exerciseSeries} labels={labels} intervals={3} plotHeight={150} />
          <View style={styles.legend}>
            {selected.map((id) => (
              <View key={id} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colorOf(id) }]} />
                <Text style={[styles.legendText, { color: Palette.muted }]}>{exerciseById(id).name}</Text>
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
