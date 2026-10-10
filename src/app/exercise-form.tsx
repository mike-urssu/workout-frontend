import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createExercise, updateExercise } from '@/api/workout';
import { CategoryChips } from '@/components/category-chips';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Font, Palette } from '@/constants/theme';
import { invalidateCategories, useCategories } from '@/hooks/use-categories';
import { errorMessage, notify } from '@/lib/dialog';

/** EX-005 종목 추가 / EX-006 종목 수정 (with `id` and the current values). Outside the tabs: no bottom nav. */
export default function ExerciseFormScreen() {
  const params = useLocalSearchParams<{ categoryId: string; id?: string; name?: string; nameEn?: string }>();
  const editing = !!params.id;
  const categories = useCategories();
  const { bottom } = useSafeAreaInsets();
  const [categoryId, setCategoryId] = useState(params.categoryId);
  const [name, setName] = useState(params.name ?? '');
  const [nameEn, setNameEn] = useState(params.nameEn ?? '');
  const [saving, setSaving] = useState(false);

  const ready = name.trim() !== '' && !saving; // BR-023: blank names count as missing
  const action = editing ? '저장' : '추가';

  const save = async () => {
    if (!ready) return;
    setSaving(true);
    try {
      const body = { categoryId, name: name.trim(), nameEn: nameEn.trim() || null };
      await (editing ? updateExercise(params.id!, body) : createExercise(body));
      invalidateCategories();
      router.back();
    } catch (e) {
      notify(errorMessage(e)); // e.g. ERR-017 a same-named exercise already exists in that body part
      setSaving(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader
          title={editing ? '종목 수정' : '종목 추가'}
          subtitle={editing ? '운동 종목의 정보를 수정하세요' : '나만의 운동 종목을 추가하세요'}
        />
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={styles.label}>
              운동 부위<Text style={styles.required}>{'  *'}</Text>
            </Text>
            <CategoryChips categories={categories} value={categoryId} onChange={setCategoryId} />
            <Text style={styles.hint}>부위를 하나 선택해 주세요.</Text>
          </View>

          <View style={styles.input}>
            <Text style={styles.label}>
              종목명<Text style={[styles.required, styles.medium]}>{'  *'}</Text>
            </Text>
            <TextInput
              style={styles.box}
              value={name}
              onChangeText={setName}
              placeholder="종목명을 입력해 주세요"
              placeholderTextColor="#70707c"
              maxLength={30}
              autoCorrect={false}
            />
          </View>

          <View style={styles.input}>
            <Text style={styles.label}>
              영어명<Text style={[styles.optional, styles.medium]}>{'  (선택)'}</Text>
            </Text>
            <TextInput
              style={styles.box}
              value={nameEn}
              onChangeText={setNameEn}
              placeholder="영어명을 입력해 주세요"
              placeholderTextColor="#70707c"
              maxLength={50}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={save}
            />
          </View>

          <Text style={styles.hint}>
            <Text style={styles.required}>*</Text> 종목명은 필수 입력 항목이에요.
          </Text>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(bottom, 16) + 8 }]}>
          {!name.trim() && <Text style={[styles.hint, styles.center]}>{`종목명을 입력하면 ${action}할 수 있어요.`}</Text>}
          <View style={styles.buttons}>
            <Pressable style={[styles.btn, styles.cancel]} onPress={() => router.back()}>
              <Text style={[styles.btnText, { color: '#fff' }]}>취소</Text>
            </Pressable>
            <Pressable style={[styles.btn, ready ? styles.primary : styles.disabled]} onPress={save} disabled={!ready}>
              <Text style={[styles.btnText, { color: ready ? Palette.bg : '#7b883f' }]}>{action}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  form: { paddingTop: 16, paddingHorizontal: 24, paddingBottom: 24, gap: 28 },
  field: { gap: 12 },
  input: { gap: 10 },
  label: { fontFamily: Font.manrope.bold, fontSize: 14, color: '#fff' },
  required: { color: Palette.accent },
  optional: { color: Palette.muted },
  medium: { fontFamily: Font.manrope.medium },
  hint: { fontFamily: Font.manrope.regular, fontSize: 12, color: Palette.muted },
  center: { textAlign: 'center' },
  box: {
    height: 56, paddingHorizontal: 18, borderRadius: 16, backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border,
    fontFamily: Font.manrope.regular, fontSize: 16, color: '#fff',
  },
  footer: { paddingHorizontal: 24, paddingTop: 8, gap: 12 },
  buttons: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, height: 55, borderRadius: 100, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  cancel: { borderColor: Palette.border },
  primary: { backgroundColor: Palette.accent, borderColor: 'transparent' },
  disabled: { backgroundColor: '#2c331a', borderColor: 'transparent' },
  btnText: { fontFamily: Font.outfit.extrabold, fontSize: 18 },
});
