import { Href, router, usePathname } from 'expo-router';
import { ChartLine, Dumbbell, House } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Font, Palette } from '@/constants/theme';

const TABS: { href: Href; label: string; Icon: typeof House; match: string[] }[] = [
  { href: '/home', label: '홈', Icon: House, match: ['/home', '/group', '/record', '/exercises'] },
  { href: '/history', label: '기록', Icon: Dumbbell, match: ['/history'] },
  { href: '/stats', label: '통계', Icon: ChartLine, match: ['/stats'] },
];

export function BottomNav() {
  const pathname = usePathname();
  const { bottom } = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: bottom }]}>
      {TABS.map(({ href, label, Icon, match }) => {
        const active = match.some((m) => pathname.startsWith(m));
        return (
          <Pressable key={label} style={styles.tab} onPress={() => router.navigate(href)}>
            <Icon size={22} color={active ? Palette.accent : 'rgba(255,255,255,0.4)'} />
            <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: Palette.card,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
  },
  tab: { width: 80, height: 72, alignItems: 'center', justifyContent: 'center', gap: 4 },
  label: { fontFamily: Font.manrope.medium, fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  labelActive: { fontFamily: Font.manrope.bold, color: '#fff' },
});
