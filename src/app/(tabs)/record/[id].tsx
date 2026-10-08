import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Clock, History, Menu, Plus, Sparkles, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Sheet } from '@/components/sheet';
import { Font, Palette } from '@/constants/theme';
import { exerciseById, groupById } from '@/data/catalog';
import { repo } from '@/data/repository';
import {
  Session, SetEntry, clock, doneSets, elapsed, isDone, kg, lastRecord, totalSets, totalVolume,
} from '@/data/workout';
import { useElapsed } from '@/hooks/use-elapsed';
import { useWorkoutData } from '@/hooks/use-workout-data';

const nowClock = () => clock(Date.now());
const newSet = (weight: number | null): SetEntry => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  weight,
  reps: null,
  time: nowClock(),
});

export default function RecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ex = exerciseById(id);
  const group = groupById(ex.group);
  const { history } = useWorkoutData();
  const [session, setSession] = useState<Session | null>(null);
  const [loadedPrev, setLoadedPrev] = useState(false);
  const [routineOpen, setRoutineOpen] = useState(false);
  const seconds = useElapsed(session?.startedAt);

  // Recording needs a session: join the active one or start it, and make sure this exercise is in it.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        let s = (await repo.getActive()) ?? (await repo.startSession());
        if (!s.exercises.some((e) => e.exerciseId === id)) {
          s = { ...s, exercises: [...s.exercises, { exerciseId: id, sets: [newSet(null)] }] };
          await repo.saveActive(s);
        }
        setSession(s);
        setLoadedPrev(false);
      })();
    }, [id]),
  );

  const sets = session?.exercises.find((e) => e.exerciseId === id)?.sets ?? [];
  const prev = lastRecord(history, id);
  const hasPrefilled = sets.some((s) => s.prefilled);

  const updateSets = (fn: (sets: SetEntry[]) => SetEntry[]) => {
    if (!session) return;
    const next = {
      ...session,
      exercises: session.exercises.map((e) => (e.exerciseId === id ? { ...e, sets: fn(e.sets) } : e)),
    };
    setSession(next);
    repo.saveActive(next);
  };
  const patch = (setId: string, p: Partial<SetEntry>) =>
    updateSets((all) => all.map((s) => (s.id === setId ? { ...s, ...p } : s)));

  const loadPrev = () => {
    if (!prev) return;
    updateSets((all) => [
      ...all.filter((s) => s.weight !== null || s.reps !== null),
      ...prev.sets.map((s, i) => ({
        id: `${Date.now()}-prev${i}`, weight: s.weight, reps: s.reps, time: '', prefilled: true,
      })),
    ]);
    setLoadedPrev(true);
  };

  const confirm = (setId: string) => patch(setId, { prefilled: false, time: nowClock() });
  const addSet = () => updateSets((all) => [...all, newSet(all[all.length - 1]?.weight ?? null)]);
  const remove = (setId: string) => updateSets((all) => all.filter((s) => s.id !== setId));

  const prevDate = prev ? new Date(prev.session.startedAt) : null;

  return (
    <Screen>
      <ScreenHeader
        title={ex.name}
        subtitle={`${group.name} • ${ex.target}`}
        // Tabs' back goes to the first tab (home); we want this exercise's list instead.
        onBack={() => router.navigate(`/group/${ex.group}`)}
        right={
          loadedPrev ? (
            <View style={[styles.prevBtn, styles.prevBtnLoaded]}>
              <History size={12} color={Palette.accent} />
              <Text style={[styles.prevText, { color: Palette.accent, fontFamily: Font.manrope.bold }]}>불러오기 완료</Text>
            </View>
          ) : (
            <Pressable style={[styles.prevBtn, !prev && { opacity: 0.4 }]} onPress={loadPrev} disabled={!prev}>
              <Text style={styles.prevText}>{prev ? '이전 기록 불러오기' : '이전 기록 없음'}</Text>
            </Pressable>
          )
        }
      />

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.meta}>
          <View style={styles.pill}>
            <View style={styles.liveDot} />
            <Text style={styles.pillText}>기록 중</Text>
          </View>
          <View style={styles.timerPill}>
            <Clock size={16} color={Palette.accent} />
            <Text style={styles.timerText}>{elapsed(seconds)}</Text>
          </View>
        </View>

        {hasPrefilled && prevDate && (
          <View style={styles.banner}>
            <Sparkles size={18} color={Palette.accent} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.bannerTitle}>{`이전 기록 (${prevDate.getMonth() + 1}월 ${prevDate.getDate()}일) 세트가 로드됨`}</Text>
              <Text style={styles.bannerSub}>값을 터치하여 이번 운동으로 적용하거나 편집하세요.</Text>
            </View>
          </View>
        )}

        <View style={styles.table}>
          <View style={[styles.tr, styles.thead]}>
            <Text style={[styles.th, { width: hasPrefilled ? 60 : 45 }]}>세트</Text>
            {!hasPrefilled && <Text style={[styles.th, styles.thDim, { width: 50 }]}>시간</Text>}
            <Text style={[styles.th, { flex: 1 }]}>무게 (kg)</Text>
            <Text style={[styles.th, { flex: 1 }]}>횟수 (회)</Text>
            <View style={{ width: 36 }} />
          </View>
          {sets.map((s, i) => (
            <View key={s.id} style={[styles.tr, styles.trBody, i < sets.length - 1 && styles.trDivider]}>
              <Text style={[styles.setLabel, { width: hasPrefilled ? 60 : 45 }, !isDone(s) && !s.prefilled && { color: Palette.muted }]}>
                {`${i + 1}세트`}
              </Text>
              {!hasPrefilled && <Text style={styles.time}>{s.time}</Text>}
              <View style={styles.cell}>
                {s.prefilled ? (
                  <Pressable style={[styles.input, styles.dimmed]} onPress={() => confirm(s.id)}>
                    <Text style={styles.inputText}>{s.weight ?? '-'}</Text>
                  </Pressable>
                ) : (
                  <NumberInput value={s.weight} onChange={(v) => patch(s.id, { weight: v })} decimal />
                )}
              </View>
              <View style={styles.cell}>
                {s.prefilled ? (
                  <Pressable style={[styles.input, styles.dimmed]} onPress={() => confirm(s.id)}>
                    <Text style={styles.inputText}>{s.reps ?? '-'}</Text>
                  </Pressable>
                ) : (
                  <NumberInput value={s.reps} onChange={(v) => patch(s.id, { reps: v })} />
                )}
              </View>
              <Pressable style={styles.delete} onPress={() => remove(s.id)} hitSlop={6}>
                <X size={20} color="rgba(255,255,255,0.4)" />
              </Pressable>
            </View>
          ))}
        </View>

        <Pressable style={styles.addSet} onPress={addSet}>
          <Plus size={16} color={Palette.accent} />
          <Text style={styles.addSetText}>세트 추가</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.routineBtn} onPress={() => setRoutineOpen(true)}>
          <Menu size={18} color="rgba(255,255,255,0.7)" />
          <Text style={styles.routineText}>오늘의 루틴 보기</Text>
        </Pressable>
      </View>

      {session && (
        <RoutineSheet session={session} currentId={id} visible={routineOpen} onClose={() => setRoutineOpen(false)} />
      )}
    </Screen>
  );
}

/** Keeps its own text so partial input like "7." survives; commits the parsed number. */
function NumberInput({ value, onChange, decimal }: { value: number | null; onChange: (v: number | null) => void; decimal?: boolean }) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const [focused, setFocused] = useState(false);
  const empty = text === '';

  return (
    <TextInput
      style={[styles.input, styles.inputText, empty && styles.inputEmpty, focused && styles.inputFocused]}
      value={text}
      placeholder="-"
      placeholderTextColor={Palette.dim}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      selectTextOnFocus
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChangeText={(t) => {
        const clean = t.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, '');
        setText(clean);
        const n = parseFloat(clean);
        onChange(Number.isNaN(n) ? null : n);
      }}
    />
  );
}

function RoutineSheet({ session, currentId, visible, onClose }: { session: Session; currentId: string; visible: boolean; onClose: () => void }) {
  const items = session.exercises.filter((e) => e.sets.length);
  return (
    <Sheet visible={visible} onClose={onClose} maxHeight="80%">
      <Text style={styles.sheetTitle}>오늘의 루틴</Text>
      <Text style={styles.sheetSub}>진행 중인 운동 목록</Text>
      <ScrollView style={{ marginTop: 8 }}>
        {items.map((e, i) => {
          const current = e.exerciseId === currentId;
          const info = exerciseById(e.exerciseId);
          return (
            <View key={e.exerciseId} style={[styles.rtRow, i > 0 && styles.rtDivider]}>
              <View style={styles.rtLeft}>
                <View style={[styles.bar, current && styles.barActive]} />
                <View style={{ gap: 4 }}>
                  <View style={styles.rtTitle}>
                    <Text style={styles.rtName}>{info.name}</Text>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{groupById(info.group).name}</Text>
                    </View>
                  </View>
                  <Text style={styles.rtTime}>{e.sets.find((s) => s.time)?.time}</Text>
                </View>
              </View>
              <Text style={[styles.rtStatus, current && { color: Palette.accent }]}>
                {current ? '진행 중' : `${doneSets(e).length}세트 완료`}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <Text style={styles.rtFooter}>
        {`총 ${items.length}개 종목 · ${kg(totalVolume(items))}kg · ${totalSets(items)}세트`}
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  prevBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  prevBtnLoaded: { backgroundColor: 'rgba(178,224,0,0.13)', borderColor: Palette.accent, borderWidth: 1.5 },
  prevText: { fontFamily: Font.manrope.medium, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  body: { paddingHorizontal: 24, paddingVertical: 8, gap: 16 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 100, backgroundColor: '#26262b', borderWidth: 1, borderColor: Palette.border,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Palette.accent },
  pillText: { fontFamily: Font.manrope.bold, fontSize: 12, color: Palette.accent },
  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 100, backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border,
  },
  timerText: { fontFamily: Font.outfit.extrabold, fontSize: 16, color: '#fff' },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 14, backgroundColor: 'rgba(178,224,0,0.13)', borderWidth: 1, borderColor: Palette.accent,
  },
  bannerTitle: { fontFamily: Font.manrope.bold, fontSize: 13, color: '#fff' },
  bannerSub: { fontFamily: Font.manrope.regular, fontSize: 11, color: Palette.muted },
  table: { backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, borderRadius: 20, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  thead: { backgroundColor: '#26262b', paddingVertical: 14 },
  th: { fontFamily: Font.manrope.bold, fontSize: 12, color: Palette.muted, textAlign: 'center' },
  thDim: { color: 'rgba(255,255,255,0.4)' },
  trBody: { paddingVertical: 6 },
  trDivider: { borderBottomWidth: 1, borderBottomColor: Palette.border },
  setLabel: { fontFamily: Font.outfit.bold, fontSize: 14, color: '#fff', textAlign: 'center' },
  time: { width: 50, fontFamily: Font.manrope.medium, fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  input: {
    width: 70, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, textAlign: 'center',
    backgroundColor: '#26262b', borderWidth: 1, borderColor: Palette.border,
  },
  inputText: { fontFamily: Font.outfit.semibold, fontSize: 14, color: '#fff', textAlign: 'center' },
  inputEmpty: { backgroundColor: Palette.border, borderColor: Palette.dim },
  inputFocused: { backgroundColor: Palette.border, borderColor: Palette.accent, borderWidth: 1.5 },
  dimmed: { width: 76, paddingVertical: 6, backgroundColor: Palette.inset, opacity: 0.5 },
  delete: { width: 36, height: 38, alignItems: 'center', justifyContent: 'center' },
  addSet: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14,
    borderRadius: 100, backgroundColor: '#26262b', borderWidth: 1, borderColor: Palette.border,
  },
  addSetText: { fontFamily: Font.manrope.bold, fontSize: 14, color: Palette.accent },
  footer: { paddingHorizontal: 24, paddingVertical: 16 },
  routineBtn: {
    height: 44, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  routineText: { fontFamily: Font.outfit.bold, fontSize: 14, color: 'rgba(255,255,255,0.7)' },

  sheetTitle: { fontFamily: Font.outfit.extrabold, fontSize: 22, color: '#fff' },
  sheetSub: { fontFamily: Font.manrope.regular, fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 6 },
  rtRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
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
  rtFooter: { fontFamily: Font.manrope.semibold, fontSize: 13, color: 'rgba(255,255,255,0.6)', paddingTop: 16 },
});
