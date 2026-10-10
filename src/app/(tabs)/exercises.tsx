import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { ApiError } from '@/api/client';
import { ExerciseItem, deleteExercise, getExercises, reorderExercises } from '@/api/workout';
import { CategoryChips } from '@/components/category-chips';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Sheet } from '@/components/sheet';
import { SortableList } from '@/components/sortable-list';
import { SwipeBack } from '@/components/swipe-back';
import { Font, Palette } from '@/constants/theme';
import { invalidateCategories, useCategories } from '@/hooks/use-categories';
import { errorMessage, notify } from '@/lib/dialog';

/** 을/를 by whether the last syllable has a final consonant (non-Hangul names get 를). */
const objectParticle = (word: string) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code < 11172 && code % 28 ? '을' : '를';
};

/** EX-004 종목 관리: entered from the exercise list of `categoryId`. */
export default function ManageExercisesScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const categories = useCategories();
  const [selected, setSelected] = useState(categoryId);
  const [items, setItems] = useState<ExerciseItem[] | null>(null); // null while loading
  const formOpen = useRef(false);
  const [target, setTarget] = useState<ExerciseItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false); // no dragging until the previous order is saved
  const scrollRef = useRef<ScrollView>(null);
  const categoryName = categories.find((c) => c.id === selected)?.name ?? '';

  // This tab screen stays mounted: every entry starts on the body part it came from,
  // but coming back from the add / edit form keeps the chip the user picked.
  useFocusEffect(
    useCallback(() => {
      if (!formOpen.current) setSelected(categoryId);
      formOpen.current = false;
      return () => {
        if (!formOpen.current) setItems(null); // left the screen: the next entry must not show this list
      };
    }, [categoryId]),
  );

  const latest = useRef(0);
  const load = useCallback(() => {
    const n = ++latest.current; // a slower response for a previous body part must not win
    getExercises(selected)
      .then((list) => n === latest.current && setItems(list))
      .catch((e) => notify(errorMessage(e)));
  }, [selected]);
  useFocusEffect(load); // also after coming back from the add / edit form

  const pick = (id: string) => {
    setSelected(id);
    setItems(null);
  };

  // API-EXERCISE-008 on every drop; the server's list wins afterwards (and on failure).
  const reorder = useCallback(
    async (ids: string[]) => {
      setItems((prev) => prev && ids.map((id) => prev.find((e) => e.id === id)!));
      setSaving(true);
      try {
        await reorderExercises(selected, ids);
      } catch (e) {
        // ERR-018: added / deleted / moved on another device meanwhile
        notify(e instanceof ApiError && e.code === 'EXERCISE_ORDER_OUTDATED'
          ? '목록이 바뀌었어요. 다시 불러왔으니 다시 옮겨 주세요.'
          : errorMessage(e));
      } finally {
        setSaving(false);
        load();
      }
    },
    [selected, load],
  );

  // Tabs' back would go to home; return to the list we came from (it reloads on focus).
  const back = () => router.navigate({ pathname: '/group/[id]', params: { id: categoryId } });

  const openForm = (ex?: ExerciseItem) => {
    formOpen.current = true;
    router.push({
      pathname: '/exercise-form',
      params: ex ? { categoryId: selected, id: ex.id, name: ex.name, nameEn: ex.nameEn ?? '' } : { categoryId: selected },
    });
  };

  const remove = async () => {
    if (!target || busy) return;
    setBusy(true);
    try {
      await deleteExercise(target.id);
      invalidateCategories();
    } catch (e) {
      notify(errorMessage(e)); // 404: already deleted on another device
    } finally {
      setTarget(null);
      load();
      setBusy(false);
    }
  };

  return (
    <Screen>
      <SwipeBack onBack={back}>
        <ScreenHeader title="종목 관리" subtitle="부위별 운동 종목을 관리하세요" onBack={back} />
        <ScrollView ref={scrollRef} contentContainerStyle={styles.body}>
          <CategoryChips categories={categories} value={selected} onChange={pick} />

          <View style={styles.listHeader}>
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>{`${categoryName} 종목`}</Text>
              <Text style={styles.count}>{items?.length}</Text>
            </View>
            <Pressable style={styles.addBtn} onPress={() => openForm()}>
              <Plus size={14} color={Palette.accent} />
              <Text style={styles.addText}>종목 추가</Text>
            </Pressable>
          </View>

          <View style={styles.cards}>
            {items?.length === 0 && <Text style={styles.empty}>종목이 없어요. 종목을 추가해 주세요.</Text>}
            {items && items.length > 1 && (
              <View style={styles.hint}>
                <Text style={styles.hintTitle}>순서 변경</Text>
                <Text style={styles.hintText}>손잡이를 드래그해 종목 순서를 바꿀 수 있어요.</Text>
              </View>
            )}
            <SortableList
              data={items ?? []}
              keyOf={(ex) => ex.id}
              itemHeight={82}
              gap={12}
              scrollRef={scrollRef}
              onReorder={reorder}
              disabled={saving}
              renderItem={(ex, handle) => (
                <View style={styles.card}>
                  {handle(
                    <View style={styles.dragArea}>
                      <View style={styles.grip}>
                        <View style={styles.gripBar} />
                        <View style={styles.gripBar} />
                        <View style={styles.gripBar} />
                      </View>
                    </View>,
                  )}
                  <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={1}>{ex.name}</Text>
                    {!!ex.nameEn && <Text style={styles.en} numberOfLines={1}>{ex.nameEn}</Text>}
                  </View>
                  <View style={styles.actions}>
                    <Pressable style={[styles.circle, styles.edit]} onPress={() => openForm(ex)}>
                      <Text style={styles.editText}>수정</Text>
                    </Pressable>
                    <Pressable style={[styles.circle, styles.delete]} onPress={() => setTarget(ex)}>
                      <Text style={styles.deleteText}>삭제</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            />
          </View>
        </ScrollView>

        <Sheet visible={target !== null} onClose={() => setTarget(null)}>
          <View style={styles.sheetTexts}>
            <Text style={styles.sheetTitle}>{target && `${target.name}${objectParticle(target.name)} 삭제할까요?`}</Text>
            <Text style={styles.sheetBody}>{`삭제하면 ${categoryName} 종목 목록에서 제외돼요.\n삭제할 종목을 다시 확인해 주세요.`}</Text>
          </View>
          <View style={styles.sheetButtons}>
            <Pressable style={[styles.sheetBtn, styles.sheetCancel]} onPress={() => setTarget(null)}>
              <Text style={[styles.sheetBtnText, { color: Palette.bg }]}>취소</Text>
            </Pressable>
            <Pressable style={[styles.sheetBtn, styles.sheetDelete, busy && { opacity: 0.5 }]} onPress={remove} disabled={busy}>
              <Text style={[styles.sheetBtnText, { color: '#fff' }]}>삭제</Text>
            </Pressable>
          </View>
        </Sheet>
      </SwipeBack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: 8, paddingHorizontal: 24, paddingBottom: 24, gap: 16 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryTitle: { fontFamily: Font.outfit.bold, fontSize: 16, color: '#fff' },
  count: { fontFamily: Font.manrope.bold, fontSize: 13, color: Palette.accent },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 100,
    backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border,
  },
  addText: { fontFamily: Font.manrope.bold, fontSize: 13, color: Palette.accent },
  cards: { gap: 12 },
  empty: { fontFamily: Font.manrope.regular, fontSize: 13, color: Palette.muted, textAlign: 'center', paddingVertical: 24 },
  hint: { paddingHorizontal: 16, gap: 4 },
  hintTitle: { fontFamily: Font.outfit.bold, fontSize: 14, color: '#fff' },
  hintText: { fontFamily: Font.manrope.regular, fontSize: 12, color: Palette.muted },
  card: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16,
    backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border,
  },
  dragArea: { width: 32, height: 48, alignItems: 'center', justifyContent: 'center' },
  grip: {
    width: 20, height: 20, borderRadius: 10, gap: 3, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border,
  },
  gripBar: { width: 10, height: 2, borderRadius: 1, backgroundColor: Palette.accent },
  info: { flex: 1, gap: 4 },
  actions: { flexDirection: 'row', gap: 6 },
  name: { fontFamily: Font.outfit.bold, fontSize: 16, color: '#fff' },
  en: { fontFamily: Font.manrope.regular, fontSize: 12, color: Palette.muted },
  circle: { width: 44, height: 44, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  edit: { backgroundColor: Palette.surface },
  editText: { fontFamily: Font.manrope.bold, fontSize: 12, color: '#fff' },
  delete: { borderWidth: 1, borderColor: Palette.border },
  deleteText: { fontFamily: Font.manrope.semibold, fontSize: 12, color: Palette.muted },
  sheetTexts: { gap: 12, marginTop: 8 },
  sheetTitle: { fontFamily: Font.outfit.extrabold, fontSize: 28, lineHeight: 34, color: '#fff', textAlign: 'center' },
  sheetBody: { fontFamily: Font.manrope.regular, fontSize: 15, lineHeight: 24, color: Palette.muted, textAlign: 'center' },
  sheetButtons: { gap: 12, marginTop: 24, marginBottom: 8 },
  sheetBtn: { height: 55, borderRadius: 100, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  sheetCancel: { backgroundColor: Palette.accent, borderColor: 'transparent' },
  sheetDelete: { borderColor: Palette.border },
  sheetBtnText: { fontFamily: Font.outfit.extrabold, fontSize: 18 },
});
