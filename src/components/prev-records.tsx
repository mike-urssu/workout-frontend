import { ChevronLeft, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ExerciseRecord, Page, getRecords } from '@/api/workout';
import { SwipeBack } from '@/components/swipe-back';
import { Font, Palette } from '@/constants/theme';
import { kg } from '@/data/workout';
import { errorMessage, notify } from '@/lib/dialog';

type Props = {
  exerciseId: string;
  exerciseName: string;
  /** page 0 (the most recent session), already loaded by the record screen */
  first: Page<ExerciseRecord>;
  onClose: () => void;
  /** every record was deleted meanwhile (on another device) */
  onEmpty: () => void;
};

/** EX-007 이전 기록: one completed session of this exercise per page; page 0 is the most recent. ‹ goes older, › newer. */
export function PrevRecords({ exerciseId, exerciseName, first, onClose, onEmpty }: Props) {
  const [data, setData] = useState(first);
  const [loading, setLoading] = useState(false);

  // Android back closes this view instead of leaving the record screen.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => (onClose(), true));
    return () => sub.remove();
  }, [onClose]);

  const go = async (page: number) => {
    setLoading(true);
    try {
      let next = await getRecords(exerciseId, page);
      if (!next.content.length && page > 0) next = await getRecords(exerciseId, 0); // records were deleted meanwhile
      if (!next.content.length) return onEmpty();
      setData(next);
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const record = data.content[0];
  const older = data.page < data.totalPages - 1;
  const newer = data.page > 0;
  const position = `${data.totalPages - data.page} / ${data.totalPages}`;
  const edge = !newer ? ' · 가장 최근 기록' : !older ? ' · 가장 오래된 기록' : '';
  const volume = record.sets.reduce((sum, s) => sum + s.weight * s.repetitions, 0);

  return (
    <SwipeBack onBack={onClose}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.iconBtn} onPress={onClose} hitSlop={8} accessibilityLabel="뒤로">
            <ChevronLeft size={16} color="#fff" />
          </Pressable>
          <Text style={styles.title}>이전 기록</Text>
        </View>
        <Pressable style={styles.iconBtn} onPress={onClose} hitSlop={8} accessibilityLabel="닫기">
          <X size={16} color={Palette.muted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.nav}>
          <Arrow label="‹" show={older} loading={loading} onPress={() => go(data.page + 1)} a11y="더 이전 기록" />
          <View style={styles.navCenter}>
            <Text style={styles.date}>{record.performedDate.replaceAll('-', '.')}</Text>
            <Text style={styles.position}>{position + edge}</Text>
          </View>
          <Arrow label="›" show={newer} loading={loading} onPress={() => go(data.page - 1)} a11y="더 이후 기록" />
        </View>

        <View style={[styles.card, loading && { opacity: 0.5 }]}>
          <View style={styles.cardHeader}>
            <View style={{ gap: 4, flexShrink: 1 }}>
              <Text style={styles.cardTitle}>세트 기록</Text>
              <Text style={styles.cardSub} numberOfLines={1}>{exerciseName}</Text>
            </View>
            <View style={styles.summary}>
              <Text style={styles.summaryText}>{`${kg(volume)}kg · ${record.sets.length}세트`}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.table}>
            <View style={[styles.tr, styles.thead]}>
              <Text style={[styles.th, { width: 60 }]}>세트</Text>
              <Text style={[styles.th, { flex: 1 }]}>무게 (kg)</Text>
              <Text style={[styles.th, { flex: 1 }]}>횟수 (회)</Text>
            </View>
            {record.sets.map((s, i) => (
              <View key={s.setNumber} style={[styles.tr, styles.trBody, i < record.sets.length - 1 && styles.trDivider]}>
                <Text style={styles.setLabel}>{`${s.setNumber}세트`}</Text>
                <View style={styles.cell}><Text style={[styles.value, styles.valueText]}>{s.weight}</Text></View>
                <View style={styles.cell}><Text style={[styles.value, styles.valueText]}>{s.repetitions}</Text></View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SwipeBack>
  );
}

/** Hidden at the end of the records (an empty slot keeps the date centered); dimmed while a page loads. */
function Arrow({ label, show, loading, onPress, a11y }: { label: string; show: boolean; loading: boolean; onPress: () => void; a11y: string }) {
  if (!show) return <View style={styles.arrow} />;
  return (
    <Pressable style={[styles.arrow, loading && { opacity: 0.35 }]} onPress={onPress} disabled={loading} hitSlop={8} accessibilityLabel={a11y}>
      <Text style={styles.arrowText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 8, borderRadius: 100, backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border },
  title: { fontFamily: Font.outfit.extrabold, fontSize: 22, color: '#fff' },
  body: { paddingHorizontal: 24, paddingVertical: 8, gap: 12 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  navCenter: { flex: 1, alignItems: 'center', gap: 4 },
  date: { fontFamily: Font.outfit.extrabold, fontSize: 18, color: '#fff' },
  position: { fontFamily: Font.manrope.regular, fontSize: 11, color: Palette.muted },
  arrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontFamily: Font.outfit.extrabold, fontSize: 26, color: '#fff' },
  card: { backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, borderRadius: 20, padding: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontFamily: Font.outfit.extrabold, fontSize: 18, color: '#fff' },
  cardSub: { fontFamily: Font.manrope.regular, fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  summary: { backgroundColor: 'rgba(178,224,0,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  summaryText: { fontFamily: Font.manrope.bold, fontSize: 12, color: Palette.accent },
  divider: { height: 1, backgroundColor: Palette.border },
  table: { backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, borderRadius: 16, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  thead: { backgroundColor: Palette.inset, paddingVertical: 10 },
  th: { fontFamily: Font.manrope.bold, fontSize: 12, color: Palette.muted, textAlign: 'center' },
  trBody: { paddingVertical: 12 },
  trDivider: { borderBottomWidth: 1, borderBottomColor: Palette.border },
  setLabel: { width: 60, fontFamily: Font.outfit.bold, fontSize: 14, color: '#fff', textAlign: 'center' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  value: { width: 76, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, backgroundColor: Palette.inset, borderWidth: 1, borderColor: Palette.border, overflow: 'hidden' },
  valueText: { fontFamily: Font.outfit.semibold, fontSize: 14, color: '#fff', textAlign: 'center' },
});
