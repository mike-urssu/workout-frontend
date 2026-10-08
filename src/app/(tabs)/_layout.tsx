import { Tabs } from 'expo-router';

import { BottomNav } from '@/components/bottom-nav';
import { Palette } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={() => <BottomNav />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: Palette.bg } }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="stats" />
      <Tabs.Screen name="group/[id]" options={{ href: null }} />
      <Tabs.Screen name="record/[id]" options={{ href: null }} />
    </Tabs>
  );
}
