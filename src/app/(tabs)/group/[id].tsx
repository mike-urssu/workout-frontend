import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ExerciseItem, getExercises, openExercise } from '@/api/workout';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Font, Palette } from '@/constants/theme';
import { daysAgoText } from '@/data/workout';
import { useCategories } from '@/hooks/use-categories';
import { errorMessage, notify } from '@/lib/dialog';

export default function ExerciseListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); // category id
  const name = useCategories().find((c) => c.id === id)?.name ?? '';
  const [items, setItems] = useState<ExerciseItem[]>([]);
  const [busy, setBusy] = useState(false);

  // Reload on focus so "최근 N일 전 완료" reflects what was just finished.
  useFocusEffect(
    useCallback(() => {
      getExercises(id).then(setItems).catch((e) => notify(errorMessage(e)));
    }, [id]),
  );

  const open = async (ex: ExerciseItem) => {
    if (busy) return;
    setBusy(true);
    try {
      const { sessionId, sessionExerciseId } = await openExercise(ex.id);
      router.push({ pathname: '/record/[id]', params: { id: ex.id, sessionId, sessionExerciseId, categoryId: id } });
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title={`${name} 운동`} subtitle={`${name} 근육 발달을 위한 운동`} />
      <ScrollView contentContainerStyle={styles.list}>
        {items.map((ex) => (
          <Pressable key={ex.id} style={styles.row} onPress={() => open(ex)} disabled={busy}>
            <View style={styles.details}>
              <Text style={styles.name}>{ex.name}</Text>
              <View style={styles.sub}>
                <Text style={styles.en}>{ex.nameEn}</Text>
                <View style={styles.dot} />
                {ex.lastPerformedDate ? (
                  <Text style={styles.recent}>{`최근 ${daysAgoText(Date.parse(`${ex.lastPerformedDate}T00:00:00`))} 완료`}</Text>
                ) : (
                  <Text style={styles.en}>기록 없음</Text>
                )}
              </View>
            </View>
            <View style={styles.chevron}>
              <ChevronRight size={16} color="#fff" />
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 24, paddingVertical: 8, gap: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border,
    borderRadius: 16, padding: 18,
  },
  details: { flex: 1, gap: 4 },
  name: { fontFamily: Font.outfit.bold, fontSize: 16, color: '#fff' },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  en: { fontFamily: Font.manrope.regular, fontSize: 12, color: Palette.dim },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: Palette.dim },
  recent: { fontFamily: Font.manrope.semibold, fontSize: 12, color: '#fff' },
  chevron: { backgroundColor: '#26262b', padding: 6, borderRadius: 100 },
});
