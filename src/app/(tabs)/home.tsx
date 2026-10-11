import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Camera, LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ApiError } from '@/api/client';
import { logout } from '@/api/auth';
import {
  Session, cancelSession, completeSession, removeExercise, sessionBreakdown, startSession, toMs, uploadMedia,
} from '@/api/workout';
import { GroupBreakdown } from '@/components/group-breakdown';
import { Screen } from '@/components/screen';
import { Sheet } from '@/components/sheet';
import { Font, Palette } from '@/constants/theme';
import { elapsed, kg, koreanDate, minSec } from '@/data/workout';
import { useActiveSession } from '@/hooks/use-active-session';
import { styleOf, useCategories } from '@/hooks/use-categories';
import { useElapsed } from '@/hooks/use-elapsed';
import { confirm, errorMessage, notify } from '@/lib/dialog';

export default function HomeScreen() {
  const { active, setActive, reload } = useActiveSession();
  const categories = useCategories();
  const seconds = useElapsed(active ? toMs(active.startedAt) : undefined);
  const [finishing, setFinishing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const recorded = active?.exercises.filter((e) => e.setCount > 0) ?? [];

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify(errorMessage(e));
      await reload(); // another device may have changed the session
    } finally {
      setBusy(false);
    }
  };

  const start = () =>
    run(async () => {
      try {
        setActive(await startSession());
      } catch (e) {
        if (e instanceof ApiError && e.code === 'WORKOUT_SESSION_ALREADY_IN_PROGRESS') return reload();
        throw e;
      }
    });

  const cancel = () =>
    run(async () => {
      if (!active || !(await confirm('운동을 취소할까요?', '운동 취소', '기록한 세트가 모두 삭제돼요.'))) return;
      await cancelSession(active.id);
      setActive(null);
    });

  const finish = () => {
    if (active && active.summary.totalSets === 0) return notify('세트를 하나 이상 기록하거나 운동을 취소하세요.');
    setFinishing(true);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { flex: 1 }]}>{'오늘의 운동을\n선택하세요'}</Text>
          <Pressable style={styles.logoutBtn} onPress={() => setLoggingOut(true)}>
            <LogOut size={16} color="#fff" />
            <Text style={styles.logoutText}>로그아웃</Text>
          </Pressable>
        </View>
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
            <View style={styles.recordedRow}>
              <Text style={styles.volumeRowLabel}>총 볼륨</Text>
              <Text style={styles.volumeRowValue}>
                {active.summary.totalVolume > 0 ? `${kg(active.summary.totalVolume)} kg` : '— kg'}
              </Text>
            </View>
            <Text style={styles.recordedLabel}>기록된 운동</Text>
            {recorded.length === 0 && <Text style={styles.empty}>아직 기록된 운동이 없어요</Text>}
            {recorded.map((e) => (
              <View key={e.sessionExerciseId} style={styles.recordedRow}>
                <Text style={styles.recordedName}>{e.name}</Text>
                <Text style={styles.recordedSets}>{`${e.setCount}세트 완료`}</Text>
              </View>
            ))}
            <Pressable onPress={cancel} disabled={busy} hitSlop={8} style={styles.cancel}>
              <Text style={styles.cancelText}>운동 취소</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.sectionLabel}>MUSCLE GROUPS</Text>
        <View style={styles.grid}>
          {categories.map((c) => (
            <Pressable key={c.id} style={styles.groupCard} onPress={() => router.push(`/group/${c.id}`)}>
              <Image source={styleOf(c.name)?.image} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={styles.groupOverlay} />
              <Text style={styles.groupName}>{c.name}</Text>
              <Text style={styles.groupCount}>{`${c.exerciseCount}개 운동`}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.cta}>
        {active ? (
          <Pressable style={[styles.ctaBtn, styles.ctaOutline]} onPress={finish} disabled={busy}>
            <Text style={[styles.ctaText, { color: Palette.accent }]}>운동 종료</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.ctaBtn, styles.ctaFilled]} onPress={start} disabled={busy}>
            <Text style={[styles.ctaText, { color: Palette.bg }]}>운동 시작</Text>
          </Pressable>
        )}
      </View>

      <Sheet visible={loggingOut} onClose={() => setLoggingOut(false)}>
        <Text style={styles.logoutTitle}>로그아웃 하시겠어요?</Text>
        <View style={{ gap: 12, marginTop: 24 }}>
          <Pressable
            style={[styles.actionBtn, styles.ctaFilled]}
            onPress={async () => {
              await logout(); // clears the token even when the request fails
              setLoggingOut(false);
              router.replace('/');
            }}>
            <Text style={[styles.ctaText, { color: Palette.bg }]}>로그아웃</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.ctaOutline]} onPress={() => setLoggingOut(false)}>
            <Text style={[styles.ctaText, { color: Palette.accent }]}>취소</Text>
          </Pressable>
        </View>
      </Sheet>

      {active && (
        <CompleteSheet
          session={active}
          seconds={seconds}
          visible={finishing}
          onClose={() => setFinishing(false)}
          onDone={() => {
            setFinishing(false);
            setActive(null);
          }}
        />
      )}
    </Screen>
  );
}

function PulseDot() {
  return (
    <Animated.View
      style={[
        styles.pulse,
        {
          animationName: { from: { opacity: 1 }, to: { opacity: 0.35 } },
          animationDuration: '800ms',
          animationIterationCount: 'infinite',
          animationDirection: 'alternate',
          animationTimingFunction: 'ease-in-out',
        },
      ]}
    />
  );
}

type CompleteProps = {
  session: Session;
  seconds: number;
  visible: boolean;
  onClose: () => void;
  onDone: () => void;
};

const MAX_MEDIA = 5;

function CompleteSheet({ session, seconds, visible, onClose, onDone }: CompleteProps) {
  const [picked, setPicked] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [uploaded, setUploaded] = useState<Record<string, string>>({}); // asset uri -> media id, kept for retries
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_MEDIA - picked.length,
    });
    if (!res.canceled) setPicked((m) => [...m, ...res.assets].slice(0, MAX_MEDIA));
  };

  /** Upload what is not uploaded yet (in picked order), then complete with the ids. Any failure stops before completing (BR-007). */
  const save = async (withMedia: boolean) => {
    setSaving(true);
    try {
      const ids: string[] = [];
      const done = { ...uploaded };
      if (withMedia) {
        for (const a of picked) {
          if (!done[a.uri]) {
            const isVideo = a.type === 'video';
            const name = a.fileName ?? `upload.${isVideo ? 'mp4' : 'jpg'}`;
            try {
              done[a.uri] = (await uploadMedia(session.id, { uri: a.uri, name, type: a.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg') })).id;
            } finally {
              setUploaded({ ...done });
            }
          }
          ids.push(done[a.uri]);
        }
      }
      // Exercises that were only opened (no sets) would otherwise count as "performed" once the session completes.
      await Promise.all(
        session.exercises.filter((e) => e.setCount === 0).map((e) => removeExercise(session.id, e.sessionExerciseId).catch(() => {})),
      );
      await completeSession(session.id, ids);
      setPicked([]);
      setUploaded({});
      setSaved(true);
    } catch (e) {
      notify(mediaMessage(e));
      if (e instanceof ApiError && ['WORKOUT_SESSION_NOT_EDITABLE', 'WORKOUT_SESSION_ALREADY_COMPLETED', 'WORKOUT_SESSION_NOT_FOUND', 'WORKOUT_SESSION_HAS_NO_SETS'].includes(e.code)) onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} maxHeight="94%">
      <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
        <Text style={styles.sheetTitle}>오늘의 운동 완료! 💪</Text>
        <View style={styles.sheetMeta}>
          <Text style={styles.sheetDate}>{`${session.performedDate.slice(0, 4)}년 ${koreanDate(new Date(`${session.performedDate}T00:00:00`)).replace(/요일$/, '')}`}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{minSec(seconds)}</Text>
          </View>
        </View>

        <View style={styles.volumeCard}>
          <Text style={styles.volumeLabel}>총 볼륨</Text>
          <Text style={styles.volumeValue}>{`${kg(session.summary.totalVolume)} kg`}</Text>
        </View>

        <GroupBreakdown groups={sessionBreakdown(session)} bg={Palette.inset} />

        <View style={styles.media}>
          <View style={styles.mediaHeader}>
            <Text style={styles.mediaLabel}>오운완 인증</Text>
            <Text style={styles.mediaCount}>{`${picked.length}/${MAX_MEDIA}`}</Text>
          </View>
          <Pressable style={styles.upload} onPress={pick} disabled={saving || picked.length >= MAX_MEDIA}>
            <View style={styles.cameraBg}>
              <Camera size={20} color={Palette.accent} />
            </View>
            <Text style={styles.uploadText}>사진 또는 동영상 추가</Text>
          </Pressable>
          <View style={styles.thumbs}>
            {Array.from({ length: MAX_MEDIA }, (_, i) => picked[i]).map((a, i) => a
              ? <PickedThumb key={a.uri} asset={a} disabled={saving} onRemove={() => setPicked((m) => m.filter((x) => x.uri !== a.uri))} />
              : <View key={`empty-${i}`} style={[styles.thumb, styles.thumbEmpty]} />)}
          </View>
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable style={[styles.actionBtn, styles.ctaFilled, saving && { opacity: 0.5 }]} onPress={() => save(true)} disabled={saving}>
          <Text style={[styles.ctaText, { color: Palette.bg }]}>{saving ? '저장 중…' : '저장하기'}</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.ctaOutline, saving && { opacity: 0.5 }]} onPress={() => save(false)} disabled={saving}>
          <Text style={[styles.ctaText, { color: Palette.accent }]}>건너뛰기</Text>
        </Pressable>
      </View>

      <Modal visible={saved} transparent animationType="fade" onRequestClose={() => { setSaved(false); onDone(); }}>
        <View style={styles.savedRoot}>
          <View style={styles.savedCard}>
            <View style={styles.savedBody}>
              <Image source={require('@/assets/images/save-success.svg')} style={{ width: 56, height: 56 }} />
              <View style={{ gap: 10, alignSelf: 'stretch' }}>
                <Text style={styles.savedTitle}>운동 기록을 저장했어요!</Text>
                <Text style={styles.savedText}>{'오늘도 끝까지 해냈네요.\n차곡차곡 쌓이는 노력, 정말 멋져요!'}</Text>
              </View>
            </View>
            <Pressable style={[styles.actionBtn, styles.ctaFilled, { alignSelf: 'stretch' }]} onPress={() => { setSaved(false); onDone(); }}>
              <Text style={[styles.ctaText, { color: Palette.bg }]}>확인</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Sheet>
  );
}

function PickedThumb({ asset, disabled, onRemove }: { asset: ImagePicker.ImagePickerAsset; disabled: boolean; onRemove: () => void }) {
  return (
    <View style={styles.thumb}>
      {asset.type === 'video' ? <VideoThumb uri={asset.uri} /> : <Image source={asset.uri} style={StyleSheet.absoluteFill} contentFit="cover" />}
      {asset.type === 'video' && (
        <View style={styles.videoDim} pointerEvents="none">
          <Image source={require('@/assets/images/media-play.svg')} style={{ width: 28, height: 28 }} />
        </View>
      )}
      <Pressable style={styles.thumbRemove} onPress={onRemove} disabled={disabled} hitSlop={8} accessibilityLabel="첨부 삭제">
        <Text style={styles.thumbRemoveText}>×</Text>
      </Pressable>
    </View>
  );
}

/** Paused player shows the first frame. */
function VideoThumb({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.muted = true; });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} pointerEvents="none" />;
}

/** Upload / complete failures (workout-media design 4.2). */
function mediaMessage(e: unknown) {
  if (e instanceof ApiError) {
    if (e.code === 'MEDIA_UNSUPPORTED_TYPE') return '지원하지 않는 파일이에요. 사진은 JPEG·PNG·HEIC, 동영상은 MP4·MOV만 가능해요.';
    if (e.code === 'MEDIA_LIMIT_EXCEEDED') {
      const limit = e.details?.limit;
      return limit === 'COUNT' ? `사진·동영상은 ${MAX_MEDIA}개까지 올릴 수 있어요.`
        : limit === 'DURATION' ? '동영상은 1분까지 올릴 수 있어요.'
        : '사진은 20MB, 동영상은 100MB까지 올릴 수 있어요.';
    }
    if (e.status === 503) return '서버에 저장하지 못했어요. 다시 시도하거나 건너뛰기를 눌러 주세요.';
    if (e.status === 0) return '네트워크 문제로 올리지 못했어요. 다시 시도하거나 건너뛰기를 눌러 주세요.';
    if (e.code === 'WORKOUT_SESSION_HAS_NO_SETS') return '세트를 하나 이상 기록해야 운동을 완료할 수 있어요.';
  }
  return errorMessage(e);
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, gap: 16 },
  title: { fontFamily: Font.outfit.extrabold, fontSize: 28, lineHeight: 34, color: '#fff' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 100, backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border,
  },
  logoutText: { fontFamily: Font.manrope.bold, fontSize: 13, color: '#fff' },
  logoutTitle: { fontFamily: Font.outfit.extrabold, fontSize: 28, lineHeight: 34, color: '#fff', textAlign: 'center', marginTop: 12 },
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
  volumeRowLabel: { fontFamily: Font.manrope.semibold, fontSize: 13, color: Palette.muted },
  volumeRowValue: { fontFamily: Font.outfit.bold, fontSize: 15, color: 'rgba(255,255,255,0.7)' },
  recordedLabel: { fontFamily: Font.manrope.bold, fontSize: 12, color: Palette.muted },
  empty: { fontFamily: Font.manrope.regular, fontSize: 13, color: Palette.dim },
  recordedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recordedName: { fontFamily: Font.outfit.bold, fontSize: 15, color: '#fff' },
  cancel: { alignSelf: 'flex-end', marginTop: 4 },
  cancelText: { fontFamily: Font.manrope.semibold, fontSize: 12, color: Palette.danger },
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
  media: { gap: 8 },
  mediaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mediaLabel: { fontFamily: Font.outfit.bold, fontSize: 14, color: Palette.muted },
  mediaCount: { fontFamily: Font.manrope.bold, fontSize: 13, color: Palette.accent },
  upload: {
    backgroundColor: Palette.inset, borderWidth: 1, borderColor: Palette.accent, borderStyle: 'dashed',
    borderRadius: 16, paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  cameraBg: { backgroundColor: 'rgba(178,224,0,0.1)', padding: 10, borderRadius: 100 },
  uploadText: { fontFamily: Font.manrope.semibold, fontSize: 14, color: Palette.accent },
  thumbs: { flexDirection: 'row', gap: 5 },
  thumb: { flex: 1, aspectRatio: 1, borderRadius: 12, overflow: 'hidden' },
  thumbEmpty: { backgroundColor: Palette.inset, borderWidth: 1, borderColor: Palette.border },
  videoDim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  thumbRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: Palette.border, alignItems: 'center', justifyContent: 'center' },
  thumbRemoveText: { fontFamily: Font.manrope.bold, fontSize: 12, color: Palette.muted },
  savedRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 24 },
  savedCard: {
    backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, borderRadius: 24,
    padding: 24, gap: 24, alignItems: 'center',
  },
  savedBody: { gap: 16, alignItems: 'center', alignSelf: 'stretch' },
  savedTitle: { fontFamily: Font.outfit.bold, fontSize: 22, lineHeight: 30, color: '#fff', textAlign: 'center' },
  savedText: { fontFamily: Font.manrope.regular, fontSize: 14, lineHeight: 22, color: Palette.muted, textAlign: 'center' },
  actions: { gap: 12, paddingTop: 12 },
  actionBtn: { height: 55, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
});
