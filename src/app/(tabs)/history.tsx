import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { Camera, ChevronLeft, ChevronRight, Play } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { Day, MediaItem, Month, dayBreakdown, deleteDay, getDay, getMonth } from '@/api/workout';
import { GroupBreakdown } from '@/components/group-breakdown';
import { MediaViewer } from '@/components/media-viewer';
import { Screen } from '@/components/screen';
import { Font, Palette } from '@/constants/theme';
import { WEEKDAY_LABELS, kg, minSec, weekday } from '@/data/workout';
import { useFileSource } from '@/hooks/use-file-source';
import { styleOf } from '@/hooks/use-categories';
import { confirm, errorMessage, notify } from '@/lib/dialog';

const pad = (n: number) => String(n).padStart(2, '0');
const ym = (y: number, m: number) => `${y}-${pad(m + 1)}`;

export default function HistoryScreen() {
  const [loaded, setLoaded] = useState(false);
  const [month, setMonth] = useState<{ y: number; m: number }>(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [monthData, setMonthData] = useState<Month | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [day, setDay] = useState<Day | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);

  const latest = useRef<string | null>(null); // ignores responses for a date tapped before the current one

  /** Keeps the previous day on screen until the new one arrives, so the content does not shrink and reset the scroll. */
  const loadDay = useCallback(async (date: string | null) => {
    latest.current = date;
    setSelected(date);
    if (!date) return setDay(null);
    try {
      const d = await getDay(date);
      if (latest.current === date) setDay(d);
    } catch (e) {
      if (latest.current === date) setDay(null);
      notify(errorMessage(e));
    }
  }, []);

  /** Loads a month (no argument = the server picks the latest recorded month) and selects its latest day. */
  const loadMonth = useCallback(async (target?: string) => {
    try {
      const data = await getMonth(target);
      setMonthData(data);
      if (data.month) {
        const [y, m] = data.month.split('-').map(Number);
        setMonth({ y, m: m - 1 });
      }
      // On the first load open the latest day; when paging months keep the selection empty.
      await loadDay(target ? null : data.latestDate);
    } catch (e) {
      setMonthData(null);
      notify(errorMessage(e));
    }
    setLoaded(true);
  }, [loadDay]);

  useFocusEffect(
    useCallback(() => {
      loadMonth();
    }, [loadMonth]),
  );

  const shift = (delta: number) => {
    const d = new Date(month.y, month.m + delta, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
    loadMonth(ym(d.getFullYear(), d.getMonth()));
  };

  const remove = async () => {
    if (!selected || !(await confirm('이 날의 기록을 삭제할까요?', '삭제', '운동 기록과 사진·동영상이 모두 삭제돼요.'))) return;
    try {
      await deleteDay(selected);
    } catch (e) {
      if (!(e instanceof ApiError) || e.code !== 'WORKOUT_DAY_NOT_FOUND') return notify(errorMessage(e));
    }
    await loadMonth(ym(month.y, month.m));
  };

  if (!loaded) return <Screen><View /></Screen>;

  const byDay = new Map((monthData?.days ?? []).map((d) => [d.date, d.categories]));
  const firstDow = new Date(month.y, month.m, 1).getDay();
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  const media = day?.media ?? [];
  const selDate = new Date(`${selected ?? ym(month.y, month.m) + '-01'}T00:00:00`);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={{ gap: 8 }}>
          <Text style={styles.title}>운동 기록</Text>
          <Text style={styles.subtitle}>{`${month.y}년 ${month.m + 1}월`}</Text>
        </View>

        <View style={styles.calendar}>
          <View style={styles.calHeader}>
            <Pressable style={styles.navBtn} onPress={() => shift(-1)}><ChevronLeft size={16} color="#fff" /></Pressable>
            <Text style={styles.monthLabel}>{`${month.y}년 ${month.m + 1}월`}</Text>
            <Pressable style={styles.navBtn} onPress={() => shift(1)}><ChevronRight size={16} color="#fff" /></Pressable>
          </View>
          <View style={styles.weekdays}>
            {WEEKDAY_LABELS.map((w) => <Text key={w} style={styles.weekday}>{w}</Text>)}
          </View>
          {weeks.map((week, wi) => (
            <View key={wi}>
              {wi > 0 && <View style={styles.weekSep} />}
              <View style={styles.week}>
                {week.map((d, di) => {
                  if (!d) return <View key={di} style={styles.day} />;
                  const key = `${ym(month.y, month.m)}-${pad(d)}`;
                  const isSel = key === selected;
                  return (
                    <Pressable key={di} style={[styles.day, isSel && styles.daySel]} onPress={() => loadDay(key)}>
                      <Text style={[styles.dayNum, isSel && styles.dayNumSel]}>{d}</Text>
                      {byDay.get(key)?.map((c) => <Text key={c.id} style={[styles.dayGroup, { color: styleOf(c.name)?.color }]}>{c.name}</Text>)}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.dayCard}>
          <View style={styles.dayHeader}>
            <View style={{ gap: 4 }}>
              <Text style={styles.dayTitle}>{`${selDate.getMonth() + 1}월 ${selDate.getDate()}일 (${weekday(selDate)})`}</Text>
              <Text style={styles.subtitle}>선택한 날짜의 세션 기록</Text>
            </View>
            {day && day.durationSeconds > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{minSec(day.durationSeconds)}</Text></View>}
          </View>

          {!day ? (
            <Text style={styles.empty}>이 날의 운동 기록이 없어요</Text>
          ) : (
            <>
              <View style={styles.divider} />
              <View style={styles.volume}>
                <Text style={styles.volumeLabel}>총 볼륨</Text>
                <Text style={styles.volumeValue}>{`${kg(day.summary.totalVolume)} kg`}</Text>
              </View>
              <GroupBreakdown groups={dayBreakdown(day)} bg={Palette.surface} />
              <Pressable onPress={remove} hitSlop={8} style={styles.remove}>
                <Text style={styles.removeText}>이 날의 기록 삭제</Text>
              </Pressable>
            </>
          )}
        </View>

        {media.length > 0 && (
          <View style={styles.gallery}>
            <View style={styles.galleryHeader}>
              <Camera size={16} color={Palette.accent} />
              <Text style={styles.galleryTitle}>오운완 인증</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {media.map((m, i) => (
                <Thumb key={m.id} item={m} onPress={() => setViewer(i)} />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <MediaViewer media={media} startIndex={viewer ?? 0} visible={viewer !== null} onClose={() => setViewer(null)} />
    </Screen>
  );
}

function Thumb({ item, onPress }: { item: MediaItem; onPress: () => void }) {
  const source = useFileSource(item.previewUrl);
  return (
    <Pressable style={styles.thumb} onPress={onPress}>
      {source && <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" />}
      {item.mediaType === 'VIDEO' && <View style={styles.play}><Play size={12} color="#fff" /></View>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingVertical: 16, gap: 16 },
  title: { fontFamily: Font.outfit.bold, fontSize: 22, color: '#fff' },
  subtitle: { fontFamily: Font.manrope.regular, fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  calendar: {
    backgroundColor: Palette.inset, borderWidth: 1, borderColor: '#2a2a33', borderRadius: 24, padding: 16, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 12 },
  },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#26262b', borderWidth: 1,
    borderColor: Palette.border, alignItems: 'center', justifyContent: 'center',
  },
  monthLabel: { fontFamily: Font.manrope.bold, fontSize: 14, color: '#fff' },
  weekdays: { flexDirection: 'row', gap: 2 },
  weekday: { flex: 1, textAlign: 'center', fontFamily: Font.manrope.bold, fontSize: 11, color: Palette.muted },
  week: { flexDirection: 'row', gap: 2, alignItems: 'flex-start' },
  weekSep: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginVertical: 1 },
  day: { flex: 1, alignItems: 'center', gap: 1, paddingTop: 5, paddingBottom: 3, paddingHorizontal: 2, borderRadius: 6, minHeight: 30, borderWidth: 1, borderColor: 'transparent' },
  daySel: { backgroundColor: 'rgba(178,224,0,0.12)', borderColor: 'rgba(178,224,0,0.4)' },
  dayNum: { fontFamily: Font.inter.regular, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  dayNumSel: { fontFamily: Font.inter.semibold, color: Palette.accent },
  dayGroup: { fontFamily: Font.inter.medium, fontSize: 7 },
  dayCard: { backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, borderRadius: 20, padding: 16, gap: 14 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayTitle: { fontFamily: Font.outfit.extrabold, fontSize: 20, color: '#fff' },
  badge: { backgroundColor: 'rgba(178,224,0,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeText: { fontFamily: Font.manrope.bold, fontSize: 12, color: Palette.accent },
  remove: { alignSelf: 'flex-end' },
  removeText: { fontFamily: Font.manrope.semibold, fontSize: 12, color: Palette.danger },
  empty: { fontFamily: Font.manrope.regular, fontSize: 13, color: Palette.dim },
  divider: { height: 1, backgroundColor: Palette.border },
  volume: { backgroundColor: '#26262b', borderWidth: 1, borderColor: Palette.border, borderRadius: 16, padding: 16, gap: 4 },
  volumeLabel: { fontFamily: Font.manrope.bold, fontSize: 13, color: Palette.muted },
  volumeValue: { fontFamily: Font.outfit.extrabold, fontSize: 28, color: Palette.accent },
  gallery: { backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, borderRadius: 16, padding: 12, gap: 10 },
  galleryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  galleryTitle: { fontFamily: Font.outfit.bold, fontSize: 14, color: Palette.muted },
  thumb: { width: 80, height: 80, borderRadius: 16, overflow: 'hidden', backgroundColor: Palette.inset, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' },
  play: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
});
