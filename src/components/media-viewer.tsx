import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { CircleX } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Font, Palette } from '@/constants/theme';
import { Media } from '@/data/workout';

type Props = { media: Media[]; startIndex: number; visible: boolean; onClose: () => void };

/** Full-screen swipeable viewer for the "오운완 인증" photos/videos. */
export function MediaViewer({ media, startIndex, visible, onClose }: Props) {
  const { width } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  const [index, setIndex] = useState(startIndex);
  const list = useRef<FlatList<Media>>(null);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={() => {
      setIndex(startIndex);
      list.current?.scrollToIndex({ index: startIndex, animated: false });
    }}>
      <View style={[styles.root, { paddingTop: top + 8, paddingBottom: bottom + 8 }]}>
        <View style={styles.topBar}>
          <View style={styles.indexPill}>
            <Text style={styles.indexText}>{`${index + 1} `}<Text style={{ color: Palette.muted }}>{`/ ${media.length}`}</Text></Text>
          </View>
          <Text style={styles.title}>오운완 인증</Text>
          <Pressable style={styles.close} onPress={onClose} hitSlop={8}>
            <CircleX size={16} color="#fff" />
          </Pressable>
        </View>

        <View style={styles.center}>
          <FlatList
            ref={list}
            data={media}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(m, i) => `${m.uri}${i}`}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item, index: i }) => (
              <View style={{ width, alignItems: 'center' }}>
                <View style={styles.frame}>
                  {item.type === 'video' ? <Video uri={item.uri} active={visible && i === index} /> : <Image source={{ uri: item.uri }} style={styles.fill} contentFit="cover" />}
                </View>
              </View>
            )}
          />
        </View>

        <View style={styles.dots}>
          {media.map((_, i) => (
            <View key={i} style={i === index ? styles.dotActive : styles.dot} />
          ))}
        </View>
      </View>
    </Modal>
  );
}

function Video({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; });
  if (active) player.play(); else player.pause();
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
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, height: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { width: 16, height: 6, borderRadius: 3, backgroundColor: Palette.accent },
});
