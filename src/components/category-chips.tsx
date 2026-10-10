import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryRef } from '@/api/workout';
import { Font, Palette } from '@/constants/theme';

type Props = { categories: CategoryRef[]; value: string; onChange: (id: string) => void };

/** Single body-part picker (종목 관리 / 종목 추가 / 종목 수정). */
export function CategoryChips({ categories, value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {categories.map((c) => {
        const on = c.id === value;
        return (
          <Pressable
            key={c.id}
            style={[styles.chip, on && styles.chipOn]}
            onPress={() => onChange(c.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}>
            <Text style={[styles.text, on && styles.textOn]}>{c.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1, height: 44, borderRadius: 100, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border,
  },
  chipOn: { backgroundColor: Palette.accent, borderColor: Palette.accent },
  text: { fontFamily: Font.manrope.bold, fontSize: 14, color: Palette.muted },
  textOn: { color: Palette.bg },
});
