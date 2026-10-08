import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { GroupBreakdown } from '@/components/group-breakdown';
import { Screen } from '@/components/screen';
import { Sheet } from '@/components/sheet';
import { Font, Palette } from '@/constants/theme';
import { GROUPS, exerciseById, exercisesOf } from '@/data/catalog';
import { repo } from '@/data/repository';
import {
  Media, Session, doneSets, elapsed, kg, koreanDate, minSec, totalVolume,
} from '@/data/workout';
import { useElapsed } from '@/hooks/use-elapsed';
import { useWorkoutData } from '@/hooks/use-workout-data';

export default function HomeScreen() {
  const { active, setActive, reload } = useWorkoutData();
  const seconds = useElapsed(active?.startedAt);
  const [finishing, setFinishing] = useState(false);

  const recorded = active?.exercises.filter((e) => doneSets(e).length) ?? [];

  const start = async () => setActive(await repo.startSession());

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{'오늘의 운동을\n선택하세요'}</Text>
        <Text style={styles.date}>{koreanDate(new Date())}</Text>

        {active && (
          <View style={styles.timerCard}>
            <View style={styles.timerHeader}>
              <View style={{ gap: 4 }}>
                <Text style={styles.live}>운동 중</Text>
                <Text style={styles.timer}>{elapsed(seconds)}</Text>
              </View>
              <PulseDot />
            </View>
            <View style={styles.divider} />
            <Text style={styles.recordedLabel}>기록된 운동</Text>
            {recorded.length === 0 && <Text style={styles.empty}>아직 기록된 운동이 없어요</Text>}
            {recorded.map((e) => (
              <View key={e.exerciseId} style={styles.recordedRow}>
                <Text style={styles.recordedName}>{exerciseById(e.exerciseId).name}</Text>
                <Text style={styles.recordedSets}>{`${doneSets(e).length}세트 완료`}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionLabel}>MUSCLE GROUPS</Text>
        <View style={styles.grid}>
          {GROUPS.map((g) => (
            <Pressable key={g.id} style={styles.groupCard} onPress={() => router.push(`/group/${g.id}`)}>
              <Image source={g.image} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={styles.groupOverlay} />
              <Text style={styles.groupName}>{g.name}</Text>
              <Text style={styles.groupCount}>{`${exercisesOf(g.id).length}개 운동`}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.cta}>
        {active ? (
          <Pressable style={[styles.ctaBtn, styles.ctaOutline]} onPress={() => setFinishing(true)}>
            <Text style={[styles.ctaText, { color: Palette.accent }]}>운동 종료</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.ctaBtn, styles.ctaFilled]} onPress={start}>
            <Text style={[styles.ctaText, { color: Palette.bg }]}>운동 시작</Text>
          </Pressable>
        )}
      </View>

      {active && (
        <CompleteSheet
          session={active}
          seconds={seconds}
          visible={finishing}
          onClose={() => setFinishing(false)}
          onDone={async (media) => {
            await repo.endSession(media);
            setFinishing(false);
            reload();
          }}
        />
      )}
    </Screen>
  );
}

function PulseDot() {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.35, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.pulse, { opacity }]} />;
}

type CompleteProps = {
  session: Session;
  seconds: number;
  visible: boolean;
  onClose: () => void;
  onDone: (media: Media[]) => void;
};

function CompleteSheet({ session, seconds, visible, onClose, onDone }: CompleteProps) {
  const [media, setMedia] = useState<Media[]>([]);
  const exercises = session.exercises.filter((e) => doneSets(e).length);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
    });
    if (res.canceled) return;
    setMedia((m) => [
      ...m,
      ...res.assets.map((a): Media => ({ uri: a.uri, type: a.type === 'video' ? 'video' : 'image' })),
    ]);
  };

  return (
    <Sheet visible={visible} onClose={onClose} maxHeight="94%">
      <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
        <Text style={styles.sheetTitle}>오늘의 운동 완료! 💪</Text>
        <View style={styles.sheetMeta}>
          <Text style={styles.sheetDate}>{`${new Date().getFullYear()}년 ${koreanDate(new Date()).replace(/요일$/, '')}`}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{minSec(seconds)}</Text>
          </View>
        </View>

        <View style={styles.volumeCard}>
          <Text style={styles.volumeLabel}>총 볼륨</Text>
          <Text style={styles.volumeValue}>{`${kg(totalVolume(exercises))} kg`}</Text>
        </View>

        <GroupBreakdown exercises={exercises} bg={Palette.inset} />

        <Text style={styles.mediaLabel}>오운완 인증</Text>
        <Pressable style={styles.upload} onPress={pick}>
          <View style={styles.cameraBg}>
            <Camera size={20} color={Palette.accent} />
          </View>
          <Text style={styles.uploadText}>
            {media.length ? `${media.length}개 선택됨 · 사진 또는 동영상 추가` : '사진 또는 동영상 추가'}
          </Text>
        </Pressable>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable style={[styles.actionBtn, styles.ctaFilled]} onPress={() => onDone(media)}>
          <Text style={[styles.ctaText, { color: Palette.bg }]}>저장하기</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.ctaOutline]} onPress={() => onDone([])}>
          <Text style={[styles.ctaText, { color: Palette.accent }]}>건너뛰기</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, gap: 16 },
  title: { fontFamily: Font.outfit.extrabold, fontSize: 28, lineHeight: 34, color: '#fff' },
  date: { fontFamily: Font.manrope.semibold, fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: -8 },
  timerCard: {
    backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border,
    borderRadius: 20, padding: 16, gap: 10,
  },
  timerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  live: { fontFamily: Font.manrope.bold, fontSize: 13, color: Palette.accent },
  timer: { fontFamily: Font.outfit.extrabold, fontSize: 44, lineHeight: 44, color: '#fff' },
  pulse: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: Palette.live,
    shadowColor: Palette.live, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
  divider: { height: 1, backgroundColor: Palette.border, marginVertical: 6 },
  recordedLabel: { fontFamily: Font.manrope.bold, fontSize: 12, color: Palette.muted },
  empty: { fontFamily: Font.manrope.regular, fontSize: 13, color: Palette.dim },
  recordedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recordedName: { fontFamily: Font.outfit.bold, fontSize: 15, color: '#fff' },
  recordedSets: { fontFamily: Font.manrope.semibold, fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  sectionLabel: { fontFamily: Font.outfit.bold, fontSize: 16, color: Palette.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  groupCard: {
    width: '47.5%', flexGrow: 1, height: 160, borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.card,
    justifyContent: 'flex-end', padding: 16, gap: 2,
  },
  groupOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(30,30,34,0.75)' },
  groupName: { fontFamily: Font.outfit.extrabold, fontSize: 20, color: '#fff' },
  groupCount: { fontFamily: Font.manrope.regular, fontSize: 12, color: Palette.muted },
  cta: { paddingHorizontal: 24, paddingVertical: 16 },
  ctaBtn: { height: 55, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  ctaFilled: { backgroundColor: Palette.accent },
  ctaOutline: { borderWidth: 1.5, borderColor: Palette.accent },
  ctaText: { fontFamily: Font.outfit.extrabold, fontSize: 18 },

  sheetBody: { gap: 20, paddingBottom: 16 },
  sheetTitle: { fontFamily: Font.outfit.extrabold, fontSize: 28, color: '#fff', textAlign: 'center' },
  sheetMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: -10 },
  sheetDate: { fontFamily: Font.manrope.semibold, fontSize: 14, color: Palette.muted },
  badge: { backgroundColor: 'rgba(178,224,0,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontFamily: Font.manrope.bold, fontSize: 12, color: Palette.accent },
  volumeCard: {
    backgroundColor: Palette.inset, borderWidth: 1, borderColor: Palette.border,
    borderRadius: 16, padding: 16, gap: 4,
  },
  volumeLabel: { fontFamily: Font.manrope.bold, fontSize: 14, color: Palette.muted },
  volumeValue: { fontFamily: Font.outfit.extrabold, fontSize: 36, color: Palette.accent },
  mediaLabel: { fontFamily: Font.outfit.bold, fontSize: 14, color: Palette.muted, marginBottom: -12 },
  upload: {
    backgroundColor: Palette.inset, borderWidth: 1, borderColor: Palette.accent, borderStyle: 'dashed',
    borderRadius: 16, paddingVertical: 24, paddingHorizontal: 16, alignItems: 'center', gap: 8,
  },
  cameraBg: { backgroundColor: 'rgba(178,224,0,0.1)', padding: 10, borderRadius: 100 },
  uploadText: { fontFamily: Font.manrope.semibold, fontSize: 14, color: Palette.accent },
  actions: { gap: 12, paddingTop: 12 },
  actionBtn: { height: 55, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
});
