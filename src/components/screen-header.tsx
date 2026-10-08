import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Font, Palette } from '@/constants/theme';

type Props = { title: string; subtitle: string; right?: ReactNode; onBack?: () => void };

export function ScreenHeader({ title, subtitle, right, onBack = () => router.back() }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Pressable style={styles.back} onPress={onBack} hitSlop={8}>
          <ChevronLeft size={20} color="#fff" />
        </Pressable>
        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        </View>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 8,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  back: { backgroundColor: Palette.card, padding: 8, borderRadius: 100 },
  texts: { gap: 2, flexShrink: 1 },
  title: { fontFamily: Font.outfit.bold, fontSize: 22, color: '#fff' },
  subtitle: { fontFamily: Font.manrope.regular, fontSize: 13, color: 'rgba(255,255,255,0.6)' },
});
