import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ApiError, tokenStore } from '@/api/client';
import { REASON_NOTICE, checkSession, login } from '@/api/auth';
import { Screen } from '@/components/screen';
import { Font, Palette } from '@/constants/theme';
import { clock } from '@/data/workout';
import { rememberLogin } from '@/lib/remember-login';

const PIN_LENGTH = 6;

export default function LoginScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState(reason ? REASON_NOTICE[reason] : undefined);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [remember, setRemember] = useState(false);
  const [pinFocused, setPinFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ field: 'username' | 'pin'; message: string } | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const pinRef = useRef<TextInput>(null);

  // App start: a stored token skips the login screen if the server still accepts it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (retryKey === 0) {
        const saved = await rememberLogin.load();
        if (cancelled) return;
        setRemember(saved.on);
        setUsername(saved.username);
      }
      const token = await tokenStore.get();
      if (!token) return setChecking(false);
      try {
        await checkSession();
        if (!cancelled) router.replace('/home');
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          await tokenStore.clear();
          setNotice(REASON_NOTICE[e.code] ?? REASON_NOTICE.UNAUTHORIZED);
        } else {
          setNotice('네트워크 연결을 확인한 뒤 다시 시도해 주세요.'); // keep the token
        }
        setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [retryKey]);

  const submit = async (value: string) => {
    if (!username.trim()) {
      setError({ field: 'username', message: '아이디를 입력해 주세요.' });
      return setPin('');
    }
    setSubmitting(true);
    try {
      await login(username.trim(), value);
      if (remember) await rememberLogin.saveUsername(username.trim());
      router.replace('/home');
    } catch (e) {
      setPin('');
      if (!(e instanceof ApiError)) throw e;
      if (e.code === 'AUTH_ACCOUNT_LOCKED') {
        const retryAt = new Date(String(e.details?.retryAt));
        setError({ field: 'pin', message: `PIN을 5회 잘못 입력해 잠겼습니다. ${clock(retryAt.getTime())} 이후 다시 시도하세요.` });
      } else if (e.code === 'AUTH_INVALID_CREDENTIALS') {
        setError({ field: 'pin', message: 'PIN이 올바르지 않습니다. 다시 입력해 주세요.' });
      } else if (e.code === 'VALIDATION_FAILED') {
        setError({ field: 'pin', message: 'PIN은 숫자 6자리여야 합니다.' });
      } else {
        setError({ field: 'pin', message: e.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRemember = () => {
    setRemember(!remember);
    rememberLogin.setOn(!remember);
  };

  const onChangePin = (text: string) => {
    if (submitting) return;
    const next = text.replace(/\D/g, '').slice(0, PIN_LENGTH);
    setError(null);
    setPin(next);
    if (next.length === PIN_LENGTH) submit(next);
  };

  if (checking) return <Screen><View /></Screen>;

  // Figma highlights the box of the last typed digit (first box while empty).
  const activeIndex = Math.max(0, pin.length - 1);
  const pinFailed = error?.field === 'pin';

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.brandHeader}>
          <View style={styles.logoRow}>
            <Text style={styles.logo}>WORKOUT</Text>
            <Image source={require('@/assets/images/accent-dot.svg')} style={styles.dot} />
          </View>
          <Text style={styles.tagline}>오늘도 함께 운동해요</Text>
        </View>

        {notice && (
          <Pressable style={styles.notice} onPress={() => setRetryKey((k) => k + 1)} disabled={!notice.includes('네트워크')}>
            <Text style={styles.noticeText}>{notice}</Text>
          </Pressable>
        )}

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>사용자 이름</Text>
            <TextInput
              style={[styles.input, error?.field === 'username' && styles.inputFailed]}
              value={username}
              onChangeText={(t) => { setUsername(t); setError(null); }}
              placeholder="아이디 입력"
              placeholderTextColor="rgba(255,255,255,0.5)"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={100}
              editable={!submitting}
              returnKeyType="next"
              onSubmitEditing={() => pinRef.current?.focus()}
            />
            {error?.field === 'username' && <Text style={styles.error}>{error.message}</Text>}
            <Pressable style={styles.rememberRow} onPress={toggleRemember} disabled={submitting} accessibilityRole="checkbox" accessibilityState={{ checked: remember }}>
              <View style={[styles.checkbox, remember && styles.checkboxOn]}>
                {remember && <Check size={14} color={Palette.bg} strokeWidth={3} />}
              </View>
              <Text style={styles.rememberText}>아이디 기억</Text>
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>PIN 입력</Text>
            <Pressable style={styles.pinRow} onPress={() => pinRef.current?.focus()}>
              {Array.from({ length: PIN_LENGTH }, (_, i) => (
                <View
                  key={i}
                  style={[styles.pinBox, pinFocused && i === activeIndex && styles.pinBoxActive, pinFailed && styles.pinBoxFailed]}>
                  <Text style={styles.pinDigit}>{i < pin.length ? '•' : ''}</Text>
                </View>
              ))}
            </Pressable>
            {pinFailed && <Text style={styles.error}>{error.message}</Text>}
            <TextInput
              ref={pinRef}
              style={styles.hiddenInput}
              value={pin}
              onChangeText={onChangePin}
              onFocus={() => setPinFocused(true)}
              onBlur={() => setPinFocused(false)}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={PIN_LENGTH}
              autoFocus={!!username} // remembered username: go straight to the PIN
              caretHidden
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  brandHeader: { gap: 8, paddingTop: 56, paddingBottom: 32 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  logo: { fontFamily: Font.outfit.black, fontSize: 36, color: '#fff' },
  dot: { width: 8, height: 8 },
  tagline: { fontFamily: Font.manrope.medium, fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  notice: {
    backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 24,
  },
  noticeText: { fontFamily: Font.manrope.semibold, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  rememberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, backgroundColor: Palette.card, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Palette.accent, borderColor: Palette.accent },
  rememberText: { fontFamily: Font.manrope.medium, fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  form: { gap: 28 },
  field: { gap: 10 },
  label: { fontFamily: Font.manrope.bold, fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  input: {
    backgroundColor: Palette.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, paddingHorizontal: 18, paddingVertical: 16,
    fontFamily: Font.manrope.medium, fontSize: 15, color: '#fff',
  },
  inputFailed: { borderColor: Palette.danger },
  pinRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  pinBox: {
    width: 48, height: 56, backgroundColor: Palette.card, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  pinBoxActive: { borderWidth: 1.5, borderColor: Palette.accent },
  pinBoxFailed: { borderWidth: 1.5, borderColor: Palette.danger },
  pinDigit: { fontFamily: Font.outfit.extrabold, fontSize: 24, color: '#fff' },
  error: { fontFamily: Font.manrope.semibold, fontSize: 12, color: Palette.danger },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
