import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { useVideoPlayer, VideoView } from 'expo-video';
import { CircleX, Download } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authHeaders } from '@/api/client';
import { Font, Palette } from '@/constants/theme';
import { MediaItem, fileUrl } from '@/api/workout';
import { useFileSource } from '@/hooks/use-file-source';
import { notify } from '@/lib/dialog';

type Props = { media: MediaItem[]; startIndex: number; visible: boolean; onClose: () => void };

/** Full-screen swipeable viewer for the "오운완 인증" photos/videos. */
export function MediaViewer({ media, startIndex, visible, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pager media={media} startIndex={startIndex} onClose={onClose} />
    </Modal>
  );
}

/** Mounts with each open (Modal drops its children when hidden), so it starts on the tapped item instead of scrolling there from the first. */
function Pager({ media, startIndex, onClose }: Omit<Props, 'visible'>) {
  const { width } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const [index, setIndex] = useState(startIndex);

  return (
    <View style={[styles.root, { paddingTop: top + 8, paddingBottom: bottom + 8 }]}>
      {/* Tapping the empty space above or below the item closes, like the × button. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
      <View style={styles.topBar} pointerEvents="box-none">
        <View style={styles.indexPill} pointerEvents="none">
          <Text style={styles.indexText}>{`${index + 1} `}<Text style={{ color: Palette.muted }}>{`/ ${media.length}`}</Text></Text>
        </View>
        <Text style={styles.title} pointerEvents="none">오운완 인증</Text>
        <Pressable style={styles.close} onPress={onClose} hitSlop={8}>
          <CircleX size={16} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.center}>
        <FlatList
          data={media}
          initialScrollIndex={startIndex}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(m) => m.id}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index: i }) => (
            <View style={{ width, alignItems: 'center' }}>
              <View style={styles.frame}>
                <Item item={item} active={i === index} />
                <DownloadButton item={item} />
              </View>
            </View>
          )}
        />
      </View>

      <View style={styles.dots} pointerEvents="none">
        {media.map((_, i) => (
          <View key={i} style={i === index ? styles.dotActive : styles.dot} />
        ))}
      </View>
    </View>
  );
}

function Item({ item, active }: { item: MediaItem; active: boolean }) {
  const original = useFileSource(item.originalUrl);
  const preview = useFileSource(item.previewUrl);
  if (item.mediaType === 'VIDEO') return original ? <Video source={original} active={active} /> : null;
  return <Image source={original ?? preview} placeholder={preview ?? undefined} style={styles.fill} contentFit="cover" />;
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'video/mp4': 'mp4', 'video/quicktime': 'mov' };

/** Saves the original to the photo library (web: a browser download). */
async function download(item: MediaItem) {
  const name = `${item.id}.${EXT[item.contentType] ?? 'bin'}`;
  const headers = await authHeaders();
  if (Platform.OS === 'web') {
    const res = await fetch(fileUrl(item.originalUrl), { headers });
    if (!res.ok) throw new Error(String(res.status));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await res.blob());
    a.download = name;
    a.click();
    return URL.revokeObjectURL(a.href);
  }
  if ((await requestPermissionsAsync(true)).status !== 'granted') return notify('사진 앱에 저장하려면 설정에서 사진 접근을 허용해 주세요.');
  const file = await File.downloadFileAsync(fileUrl(item.originalUrl), new File(Paths.cache, name), { headers, idempotent: true });
  await Asset.create(file.uri);
  file.delete();
  notify('사진 앱에 저장했어요.');
}

function DownloadButton({ item }: { item: MediaItem }) {
  const [busy, setBusy] = useState(false);
  const onPress = async () => {
    setBusy(true);
    try {
      await download(item);
    } catch {
      notify('저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable style={[styles.download, busy && { opacity: 0.5 }]} onPress={onPress} disabled={busy} hitSlop={8} accessibilityLabel="다운로드">
      <Download size={16} color={Palette.accent} />
    </Pressable>
  );
}

/** Plays while on screen; play/pause, seeking and sound are the native controls. */
function Video({ source, active }: { source: { uri: string; headers?: Record<string, string> }; active: boolean }) {
  const player = useVideoPlayer(source, (p) => { p.loop = true; });
  // An effect, not render: re-renders must not undo a pause the user made with the controls.
  useEffect(() => {
    if (active) player.play(); else player.pause();
  }, [active, player]);
  return <VideoView player={player} style={styles.fill} contentFit="cover" nativeControls />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(5,5,6,0.94)', justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 12 },
  indexPill: { backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6 },
  indexText: { fontFamily: Font.manrope.bold, fontSize: 13, color: '#fff' },
  title: { fontFamily: Font.outfit.extrabold, fontSize: 18, color: '#fff' },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' },
  center: { height: 400 },
  frame: {
    width: 350, height: 400, borderRadius: 24, overflow: 'hidden', backgroundColor: Palette.inset,
    borderWidth: 1.5, borderColor: Palette.border,
    shadowColor: '#000', shadowOpacity: 0.63, shadowRadius: 32, shadowOffset: { width: 0, height: 12 },
  },
  fill: { width: '100%', height: '100%' },
  download: {
    position: 'absolute', top: 10.5, right: 10.5, width: 36, height: 36, borderRadius: 18,
    backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, height: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { width: 16, height: 6, borderRadius: 3, backgroundColor: Palette.accent },
});
