import { router, useLocalSearchParams } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Font, Palette } from '@/constants/theme';
import { exercisesOf, groupById } from '@/data/catalog';
import { daysAgoText, lastRecord } from '@/data/workout';
import { useWorkoutData } from '@/hooks/use-workout-data';

export default function ExerciseListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = groupById(id);
  const { history } = useWorkoutData();

  return (
    <Screen>
      <ScreenHeader title={`${group.name} 운동`} subtitle={`${group.name} 근육 발달을 위한 추천 루틴`} />
      <ScrollView contentContainerStyle={styles.list}>
        {exercisesOf(id).map((ex) => {
          const last = lastRecord(history, ex.id);
          return (
            <Pressable key={ex.id} style={styles.row} onPress={() => router.push(`/record/${ex.id}`)}>
              <View style={styles.details}>
                <Text style={styles.name}>{ex.name}</Text>
                <View style={styles.sub}>
                  <Text style={styles.en}>{ex.en}</Text>
                  <View style={styles.dot} />
                  {last ? (
                    <Text style={styles.recent}>{`최근 ${daysAgoText(last.session.startedAt)} 완료`}</Text>
                  ) : (
                    <Text style={styles.en}>기록 없음</Text>
                  )}
                </View>
              </View>
              <View style={styles.chevron}>
                <ChevronRight size={16} color="#fff" />
              </View>
            </Pressable>
          );
        })}
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
