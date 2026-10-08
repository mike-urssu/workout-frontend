import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import {
  Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import {
  Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold, Outfit_900Black,
} from '@expo-google-fonts/outfit';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Palette } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

// The Figma design is dark-only.
const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: Palette.bg } };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
    Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold,
    Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold, Outfit_900Black,
  });
  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
