import { Menu } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Session, toMs } from '@/api/workout';
import { Sheet } from '@/components/sheet';
import { Font, Palette } from '@/constants/theme';
import { clock, kg } from '@/data/workout';

/** "오늘의 루틴 보기" outline button (exercise list and recording screens). */
export function RoutineButton({ onOpen }: { onOpen: () => void }) {
  return (
    <Pressable style={styles.routineBtn} onPress={onOpen}>
      <Menu size={18} color="rgba(255,255,255,0.7)" />
      <Text style={styles.routineText}>오늘의 루틴 보기</Text>
    </Pressable>
  );
}

/** The in-progress session's exercises (null = no session yet). `currentId` marks the exercise being recorded. */
export function RoutineSheet({ session, currentId, visible, onClose }: { session: Session | null; currentId?: string; visible: boolean; onClose: () => void }) {
  const items = (session?.exercises ?? []).filter((e) => e.setCount > 0 || e.sessionExerciseId === currentId);
  return (
    <Sheet visible={visible} onClose={onClose} maxHeight="80%">
      <Text style={styles.sheetTitle}>오늘의 루틴</Text>
      <Text style={styles.sheetSub}>진행 중인 운동 목록</Text>
      <Text style={styles.rtSummary}>
        {`총 ${session?.summary.exerciseCount ?? 0}개 종목 · ${kg(session?.summary.totalVolume ?? 0)}kg · ${session?.summary.totalSets ?? 0}세트`}
      </Text>
      {items.length === 0 && <Text style={styles.rtEmpty}>아직 기록한 운동이 없어요</Text>}
      <ScrollView>
        {items.map((e, i) => {
          const current = e.sessionExerciseId === currentId;
          return (
            <View key={e.sessionExerciseId} style={[styles.rtRow, i > 0 && styles.rtDivider]}>
              <View style={styles.rtLeft}>
                <View style={[styles.bar, current && styles.barActive]} />
                <View style={{ gap: 4 }}>
                  <View style={styles.rtTitle}>
                    <Text style={styles.rtName}>{e.name}</Text>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{e.category.name}</Text>
                    </View>
                  </View>
                  <Text style={styles.rtTime}>{e.firstSetAt ? clock(toMs(e.firstSetAt)) : ''}</Text>
                </View>
              </View>
              <Text style={[styles.rtStatus, current && { color: Palette.accent }]}>
                {current ? '진행 중' : `${e.setCount}세트 완료`}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheetTitle: { fontFamily: Font.outfit.extrabold, fontSize: 22, color: '#fff' },
  sheetSub: { fontFamily: Font.manrope.regular, fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  rtRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  rtDivider: { borderTopWidth: 1, borderTopColor: Palette.border },
  rtLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bar: { width: 4, height: 36 },
  barActive: { backgroundColor: Palette.accent, borderRadius: 2 },
  rtTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rtName: { fontFamily: Font.outfit.semibold, fontSize: 15, color: '#fff' },
  tag: { backgroundColor: Palette.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontFamily: Font.manrope.medium, fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  rtTime: { fontFamily: Font.manrope.regular, fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  rtStatus: { fontFamily: Font.manrope.semibold, fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  rtSummary: { fontFamily: Font.manrope.semibold, fontSize: 13, color: 'rgba(255,255,255,0.6)', paddingVertical: 2, marginTop: 8, marginBottom: 2 },
  routineBtn: {
    height: 44, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  routineText: { fontFamily: Font.outfit.bold, fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  rtEmpty: { fontFamily: Font.manrope.regular, fontSize: 13, color: Palette.dim, marginTop: 16 },
});
