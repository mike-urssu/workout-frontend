import { Manrope_500Medium, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { Outfit_800ExtraBold, Outfit_900Black } from '@expo-google-fonts/outfit';
import { useFonts } from 'expo-font';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PIN_LENGTH = 6;

// 더미 계정 — API 연결 시 교체
const DUMMY_USER = { username: 'test', pin: '123456' };

export default function LoginScreen() {
  const [fontsLoaded] = useFonts({
    Manrope_500Medium,
    Manrope_700Bold,
    Outfit_800ExtraBold,
    Outfit_900Black,
  });
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [pinFocused, setPinFocused] = useState(false);
  const pinRef = useRef<TextInput>(null);

  if (!fontsLoaded) return null;

  const login = (value: string) => {
    // TODO: 더미 검증 대신 로그인 API 호출
    if (username === DUMMY_USER.username && value === DUMMY_USER.pin) {
      router.replace('/home');
    } else {
      Alert.alert('로그인 실패', '아이디 또는 PIN이 올바르지 않아요');
      setPin('');
    }
  };

  const onChangePin = (text: string) => {
    const next = text.replace(/\D/g, '').slice(0, PIN_LENGTH);
    setPin(next);
    if (next.length === PIN_LENGTH) login(next);
  };

  const activeIndex = Math.min(pin.length, PIN_LENGTH - 1);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.brandHeader}>
        <View style={styles.logoRow}>
          <Text style={styles.logo}>WORKOUT</Text>
          <Image source={require('@/assets/images/accent-dot.svg')} style={styles.dot} />
        </View>
        <Text style={styles.tagline}>오늘도 함께 운동해요</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>사용자 이름</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="아이디 입력"
            placeholderTextColor="rgba(255,255,255,0.5)"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => pinRef.current?.focus()}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>PIN 입력</Text>
          <Pressable style={styles.pinRow} onPress={() => pinRef.current?.focus()}>
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <View
                key={i}
                style={[styles.pinBox, pinFocused && i === activeIndex && styles.pinBoxActive]}>
                <Text style={styles.pinDigit}>{pin[i] ?? ''}</Text>
              </View>
            ))}
          </Pressable>
          <TextInput
            ref={pinRef}
            style={styles.hiddenInput}
            value={pin}
            onChangeText={onChangePin}
            onFocus={() => setPinFocused(true)}
            onBlur={() => setPinFocused(false)}
            keyboardType="number-pad"
            maxLength={PIN_LENGTH}
            caretHidden
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121214', paddingHorizontal: 24 },
  brandHeader: { gap: 8, paddingTop: 56, paddingBottom: 32 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  logo: { fontFamily: 'Outfit_900Black', fontSize: 36, color: '#fff' },
  dot: { width: 8, height: 8 },
  tagline: { fontFamily: 'Manrope_500Medium', fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  form: { gap: 28 },
  field: { gap: 10 },
  label: { fontFamily: 'Manrope_700Bold', fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  input: {
    backgroundColor: '#1e1e22',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontFamily: 'Manrope_500Medium',
    fontSize: 15,
    color: '#fff',
  },
  pinRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  pinBox: {
    width: 48,
    height: 56,
    backgroundColor: '#1e1e22',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBoxActive: { borderWidth: 1.5, borderColor: '#b2e000' },
  pinDigit: { fontFamily: 'Outfit_800ExtraBold', fontSize: 24, color: '#fff' },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
