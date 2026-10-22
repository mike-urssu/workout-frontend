import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Clock, Plus, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError } from '@/api/client';
import {
  ExerciseRecord, Page, Session, SessionExercise, addSet, deleteSet, getInProgress, getRecords, toMs, updateSet,
} from '@/api/workout';
import { PrevRecords } from '@/components/prev-records';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { RoutineButton, RoutineSheet } from '@/components/routine-sheet';
import { SwipeBack } from '@/components/swipe-back';
import { Font, Palette } from '@/constants/theme';
import { clockSec, elapsed } from '@/data/workout';
import { refreshActiveSession } from '@/hooks/use-active-session';
import { useElapsed } from '@/hooks/use-elapsed';
import { errorMessage, notify } from '@/lib/dialog';

/** One table row. `id` = saved on the server; no id = still a draft. */
type Row = {
  key: string; id?: string; weight: number | null; reps: number | null; time: string;
  saving?: boolean; invalid?: boolean;
  /** last values the server has, to skip a PUT when nothing changed */
  saved?: { weight: number; reps: number };
};

const TIME_W = 66; // fits "14:23:05"
let draftSeq = 0;
const draft = (): Row => ({ key: `draft-${draftSeq++}`, weight: null, reps: null, time: '' });
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
  const [prev, setPrev] = useState<Page<ExerciseRecord> | null>(null);
  const [prevOpen, setPrevOpen] = useState(false);
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
          setRows(mine.sets.length ? mine.sets.map(fromServer) : [draft()]);
          setPrevOpen(false);
          setPrev(await getRecords(id).catch(() => null)); // recording works without it; the button then reads "이전 기록 없음"
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
      patch(key, { id: saved.id, time: clockSec(toMs(saved.createdAt)), saving: false, saved: { weight: saved.weight, reps: saved.repetitions } });
      refreshActiveSession().catch(() => {}); // the home tab's card shows the new totals as soon as it is back in view
    } catch (e) {
      patch(key, { saving: false, invalid: e instanceof ApiError && e.code === 'VALIDATION_FAILED' });
      fail(e);
    }
  };

  const remove = async (row: Row) => {
    try {
      if (row.id) {
        await deleteSet(sessionId, sessionExerciseId, row.id);
        refreshActiveSession().catch(() => {});
      }
      setRows((all) => (all.length > 1 ? all.filter((r) => r.key !== row.key) : [draft()]));
    } catch (e) {
      fail(e);
    }
  };

  const addRow = () => setRows((all) => [...all, draft()]);

  const hasPrev = !!prev?.totalElements;
  const closePrev = useCallback(() => setPrevOpen(false), []);

  // Shown in place of the record screen (the tab bar stays, as in the design); the rows above are kept.
  if (prevOpen && prev && hasPrev) {
    return (
      <Screen>
        <PrevRecords exerciseId={id} exerciseName={ex?.name ?? ''} first={prev} onClose={closePrev} onEmpty={() => { setPrev(null); setPrevOpen(false); }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <SwipeBack onBack={backToList}>
      <ScreenHeader
        title={ex?.name ?? ''}
        // user-added exercises have no target (BR-028)
        subtitle={ex ? [ex.category.name, ex.target].filter(Boolean).join(' • ') : ''}
        // Tabs' back goes to the first tab (home); we want this exercise's list instead.
        onBack={backToList}
        right={
          <Pressable style={[styles.prevBtn, !hasPrev && { opacity: 0.4 }]} onPress={() => setPrevOpen(true)} disabled={!hasPrev}>
            <Text style={styles.prevText} numberOfLines={1}>{hasPrev ? '이전 기록 조회' : '이전 기록 없음'}</Text>
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

        <View style={styles.table}>
          <View style={[styles.tr, styles.thead]}>
            <Text style={[styles.th, { width: 45 }]}>세트</Text>
            <Text style={[styles.th, styles.thDim, { width: TIME_W }]}>시간</Text>
            <Text style={[styles.th, { flex: 1 }]}>무게 (kg)</Text>
            <Text style={[styles.th, { flex: 1 }]}>횟수 (회)</Text>
            <View style={{ width: 36 }} />
          </View>
          {rows.map((s, i) => (
            <View key={s.key} style={[styles.tr, styles.trBody, i < rows.length - 1 && styles.trDivider]}>
              <Text style={[styles.setLabel, { width: 45 }, !s.id && { color: Palette.muted }]}>
                {`${i + 1}세트`}
              </Text>
              <Text style={styles.time}>{s.time}</Text>
              <View style={styles.cell}>
                <NumberInput value={s.weight} invalid={s.invalid} onCommit={(v) => commit(s.key, { weight: v })} decimal />
              </View>
              <View style={styles.cell}>
                <NumberInput value={s.reps} invalid={s.invalid} onCommit={(v) => commit(s.key, { reps: v })} />
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
        <RoutineButton
          onOpen={async () => {
            try {
              const next = await getInProgress(); // fresh numbers for the other exercises
              if (next) setSession(next);
            } catch {}
            setRoutineOpen(true);
          }}
        />
      </View>

      <RoutineSheet session={session} currentId={sessionExerciseId} visible={routineOpen} onClose={() => setRoutineOpen(false)} />
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

const styles = StyleSheet.create({
  prevBtn: {
    width: 124, height: 32, justifyContent: 'center', paddingHorizontal: 12,
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  prevText: { fontFamily: Font.manrope.medium, fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
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
  delete: { width: 36, height: 38, alignItems: 'center', justifyContent: 'center' },
  addSet: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14,
    borderRadius: 100, backgroundColor: '#26262b', borderWidth: 1, borderColor: Palette.border,
  },
  addSetText: { fontFamily: Font.manrope.bold, fontSize: 14, color: Palette.accent },
  footer: { paddingHorizontal: 24, paddingVertical: 16 },

});
