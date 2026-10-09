import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Clock, History, Menu, Plus, Sparkles, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import {
  LastRecord, Session, SessionExercise, addSet, clearSets, deleteSet, getInProgress, getLastRecord, toMs, updateSet,
} from '@/api/workout';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Sheet } from '@/components/sheet';
import { SwipeBack } from '@/components/swipe-back';
import { Font, Palette } from '@/constants/theme';
import { clockSec, elapsed, kg } from '@/data/workout';
import { useElapsed } from '@/hooks/use-elapsed';
import { confirm, errorMessage, notify } from '@/lib/dialog';

/** One table row. `id` = saved on the server; no id = still a draft (or a not-yet-applied previous value). */
type Row = {
  key: string; id?: string; weight: number | null; reps: number | null; time: string;
  prefilled?: boolean; saving?: boolean; invalid?: boolean;
  /** last values the server has, to skip a PUT when nothing changed */
  saved?: { weight: number; reps: number };
};

const TIME_W = 66; // fits "14:23:05"
let draftSeq = 0;
const draft = (weight: number | null, over: Partial<Row> = {}): Row => ({ key: `draft-${draftSeq++}`, weight, reps: null, time: '', ...over });
const fromServer = (s: SessionExercise['sets'][number]): Row => ({
  key: s.id, id: s.id, weight: s.weight, reps: s.repetitions, time: clockSec(toMs(s.createdAt)),
  saved: { weight: s.weight, reps: s.repetitions },
});
// Client-side copy of the server rules (BR-003, BR-005); the server checks again.
const validWeight = (w: number) => w >= 0 && w <= 1000 && Math.abs(w * 100 - Math.round(w * 100)) < 1e-6;
const validReps = (r: number) => Number.isInteger(r) && r >= 1 && r <= 1000;

export default function RecordScreen() {
  const { id, sessionId, sessionExerciseId, categoryId } = useLocalSearchParams<{
    id: string; sessionId: string; sessionExerciseId: string; categoryId: string;
  }>();
  const [session, setSession] = useState<Session | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [prev, setPrev] = useState<LastRecord | null>(null);
  const [loadedPrev, setLoadedPrev] = useState(false);
  const [routineOpen, setRoutineOpen] = useState(false);
  const seconds = useElapsed(session ? toMs(session.startedAt) : undefined);

  const ex = session?.exercises.find((e) => e.sessionExerciseId === sessionExerciseId);
  const backToList = () => router.navigate(`/group/${categoryId ?? ex?.category.id}`);

  /** Failures that mean this screen can no longer be used (design 4.2 EX-002). */
  const fail = (e: unknown) => {
    notify(errorMessage(e));
    if (!(e instanceof ApiError)) return;
    if (e.code === 'SESSION_EXERCISE_NOT_FOUND') backToList();
    else if (['WORKOUT_SESSION_NOT_EDITABLE', 'WORKOUT_SESSION_ALREADY_COMPLETED', 'WORKOUT_SESSION_NOT_FOUND'].includes(e.code)) router.replace('/home');
  };

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const s = await getInProgress();
          const mine = s?.id === sessionId ? s.exercises.find((e) => e.sessionExerciseId === sessionExerciseId) : undefined;
          if (!s || !mine) return fail(new ApiError(404, 'WORKOUT_SESSION_NOT_FOUND', '진행 중인 운동을 찾을 수 없어요.'));
          setSession(s);
          setRows(mine.sets.length ? mine.sets.map(fromServer) : [draft(null)]);
          setLoadedPrev(false);
          setPrev(await getLastRecord(id));
        } catch (e) {
          fail(e);
        }
      })();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, sessionId, sessionExerciseId]),
  );

  const patch = (key: string, p: Partial<Row>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...p } : r)));

  /** Saves a row once both values are there: POST for a new set, PUT for an edited one. */
  const commit = async (key: string, p: Partial<Row>) => {
    const row = { ...rows.find((r) => r.key === key)!, ...p };
    patch(key, p);
    if (row.weight === null || row.reps === null || row.saving) return;
    if (!validWeight(row.weight) || !validReps(row.reps)) return patch(key, { invalid: true });
    if (row.saved && row.saved.weight === row.weight && row.saved.reps === row.reps) return patch(key, { invalid: false });
    patch(key, { saving: true, invalid: false });
    try {
      const saved = row.id
        ? await updateSet(sessionId, sessionExerciseId, row.id, row.weight, row.reps)
        : await addSet(sessionId, sessionExerciseId, row.weight, row.reps);
      // ponytail: edits made while this request is in flight are not saved; blur again to save them
      patch(key, { id: saved.id, time: clockSec(toMs(saved.createdAt)), prefilled: false, saving: false, saved: { weight: saved.weight, reps: saved.repetitions } });
    } catch (e) {
      patch(key, { saving: false, invalid: e instanceof ApiError && e.code === 'VALIDATION_FAILED' });
      fail(e);
    }
  };

  const remove = async (row: Row) => {
    try {
      if (row.id) await deleteSet(sessionId, sessionExerciseId, row.id);
      setRows((all) => (all.length > 1 ? all.filter((r) => r.key !== row.key) : [draft(null)]));
    } catch (e) {
      fail(e);
    }
  };

  const addRow = () => setRows((all) => [...all, draft(null)]);

  /** BR-021: loading replaces the sets of this exercise; saved sets are deleted after a confirmation. */
  const loadPrev = async () => {
    if (!prev) return;
    const hasSaved = rows.some((r) => r.id);
    if (hasSaved && !(await confirm('이전 기록으로 덮어쓸까요?', '덮어쓰기', '지금 기록한 세트가 모두 삭제돼요.'))) return;
    try {
      if (hasSaved) await clearSets(sessionId, sessionExerciseId);
    } catch (e) {
      return fail(e);
    }
    setRows(prev.sets.map((s) => draft(s.weight, { reps: s.repetitions, prefilled: true })));
    setLoadedPrev(true);
  };

  const hasPrefilled = rows.some((r) => r.prefilled);
  const prevDate = prev ? new Date(`${prev.performedDate}T00:00:00`) : null;

  return (
    <Screen>
      <SwipeBack onBack={backToList}>
      <ScreenHeader
        title={ex?.name ?? ''}
        subtitle={ex ? `${ex.category.name} • ${ex.target}` : ''}
        // Tabs' back goes to the first tab (home); we want this exercise's list instead.
        onBack={backToList}
        right={
          <Pressable style={[styles.prevBtn, loadedPrev && styles.prevBtnLoaded, !prev && { opacity: 0.4 }]} onPress={loadPrev} disabled={!prev}>
            {loadedPrev && <History size={12} color={Palette.accent} />}
            <Text style={[styles.prevText, loadedPrev && { color: Palette.accent, fontFamily: Font.manrope.bold }]}>
              {!prev ? '이전 기록 없음' : loadedPrev ? '다시 불러오기' : '이전 기록 불러오기'}
            </Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        // iOS: lift the content above the keyboard and scroll the focused field into view (Android resizes the window).
        automaticallyAdjustKeyboardInsets
        // number pads have no "done" key, so dragging the list is how the keyboard is dismissed
        keyboardDismissMode="on-drag">
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
            {!hasPrefilled && <Text style={[styles.th, styles.thDim, { width: TIME_W }]}>시간</Text>}
            <Text style={[styles.th, { flex: 1 }]}>무게 (kg)</Text>
            <Text style={[styles.th, { flex: 1 }]}>횟수 (회)</Text>
            <View style={{ width: 36 }} />
          </View>
          {rows.map((s, i) => (
            <View key={s.key} style={[styles.tr, styles.trBody, i < rows.length - 1 && styles.trDivider]}>
              <Text style={[styles.setLabel, { width: hasPrefilled ? 60 : 45 }, !s.id && !s.prefilled && { color: Palette.muted }]}>
                {`${i + 1}세트`}
              </Text>
              {!hasPrefilled && <Text style={styles.time}>{s.time}</Text>}
              <View style={styles.cell}>
                {s.prefilled ? (
                  <Pressable style={[styles.input, styles.dimmed]} onPress={() => commit(s.key, {})}>
                    <Text style={styles.inputText}>{s.weight ?? '-'}</Text>
                  </Pressable>
                ) : (
                  <NumberInput value={s.weight} invalid={s.invalid} onCommit={(v) => commit(s.key, { weight: v })} decimal />
                )}
              </View>
              <View style={styles.cell}>
                {s.prefilled ? (
                  <Pressable style={[styles.input, styles.dimmed]} onPress={() => commit(s.key, {})}>
                    <Text style={styles.inputText}>{s.reps ?? '-'}</Text>
                  </Pressable>
                ) : (
                  <NumberInput value={s.reps} invalid={s.invalid} onCommit={(v) => commit(s.key, { reps: v })} />
                )}
              </View>
              <Pressable style={styles.delete} onPress={() => remove(s)} hitSlop={6}>
                <X size={20} color="rgba(255,255,255,0.4)" />
              </Pressable>
            </View>
          ))}
        </View>

        <Pressable style={styles.addSet} onPress={addRow}>
          <Plus size={16} color={Palette.accent} />
          <Text style={styles.addSetText}>세트 추가</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.routineBtn}
          onPress={async () => {
            try {
              const s = await getInProgress(); // fresh numbers for the other exercises
              if (s) setSession(s);
            } catch {}
            setRoutineOpen(true);
          }}>
          <Menu size={18} color="rgba(255,255,255,0.7)" />
          <Text style={styles.routineText}>오늘의 루틴 보기</Text>
        </Pressable>
      </View>

      {session && (
        <RoutineSheet session={session} currentId={sessionExerciseId} visible={routineOpen} onClose={() => setRoutineOpen(false)} />
      )}
      </SwipeBack>
    </Screen>
  );
}

/** Keeps its own text so partial input like "7." survives; reports the parsed number when the field loses focus. */
function NumberInput({ value, onCommit, decimal, invalid }: { value: number | null; onCommit: (v: number | null) => void; decimal?: boolean; invalid?: boolean }) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const [focused, setFocused] = useState(false);
  const empty = text === '';

  return (
    <TextInput
      style={[styles.input, styles.inputText, empty && styles.inputEmpty, focused && styles.inputFocused, invalid && styles.inputInvalid]}
      value={text}
      placeholder="-"
      placeholderTextColor={Palette.dim}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      selectTextOnFocus
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        const n = parseFloat(text);
        onCommit(Number.isNaN(n) ? null : n);
      }}
      onChangeText={(t) => setText(t.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, ''))}
    />
  );
}

function RoutineSheet({ session, currentId, visible, onClose }: { session: Session; currentId: string; visible: boolean; onClose: () => void }) {
  const items = session.exercises.filter((e) => e.setCount > 0 || e.sessionExerciseId === currentId);
  return (
    <Sheet visible={visible} onClose={onClose} maxHeight="80%">
      <Text style={styles.sheetTitle}>오늘의 루틴</Text>
      <Text style={styles.sheetSub}>진행 중인 운동 목록</Text>
      <ScrollView style={{ marginTop: 8 }}>
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
                  <Text style={styles.rtTime}>{e.firstSetAt ? clockSec(toMs(e.firstSetAt)) : ''}</Text>
                </View>
              </View>
              <Text style={[styles.rtStatus, current && { color: Palette.accent }]}>
                {current ? '진행 중' : `${e.setCount}세트 완료`}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <Text style={styles.rtFooter}>
        {`총 ${session.summary.exerciseCount}개 종목 · ${kg(session.summary.totalVolume)}kg · ${session.summary.totalSets}세트`}
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
  body: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, gap: 16 },
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
  time: { width: TIME_W, fontFamily: Font.manrope.medium, fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  input: {
    width: 70, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, textAlign: 'center',
    backgroundColor: '#26262b', borderWidth: 1, borderColor: Palette.border,
  },
  inputText: { fontFamily: Font.outfit.semibold, fontSize: 14, color: '#fff', textAlign: 'center' },
  inputEmpty: { backgroundColor: Palette.border, borderColor: Palette.dim },
  inputFocused: { backgroundColor: Palette.border, borderColor: Palette.accent, borderWidth: 1.5 },
  inputInvalid: { borderColor: Palette.danger, borderWidth: 1.5 },
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
