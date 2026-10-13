import { createContext, ReactNode, useContext, useEffect, useMemo } from 'react';
import { Modal, Pressable, ScrollViewProps, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView, NativeGesture } from 'react-native-gesture-handler';
import Animated, {
  ReduceMotion, SharedValue, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Palette } from '@/constants/theme';

type Props = { visible: boolean; onClose: () => void; maxHeight?: `${number}%`; children: ReactNode };

const SETTLE = { duration: 300, dampingRatio: 0.9, reduceMotion: ReduceMotion.System };
const SLIDE = { duration: 250, reduceMotion: ReduceMotion.System };
const CLOSE_DISTANCE = 100;
const CLOSE_VELOCITY = 800;

const ScrollCtx = createContext<{ gesture: NativeGesture; y: SharedValue<number> } | null>(null);

/** Bottom sheet with a dimmed scrim (workout-complete / today-workout popups). Drag down to close. */
export function Sheet({ visible, onClose, maxHeight = '90%', children }: Props) {
  const { bottom } = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const ty = useSharedValue(height); // sheet offset; the scrim fades with it
  const scrollY = useSharedValue(0);
  const from = useSharedValue(0); // finger translation at which the sheet started following it
  const scroll = useMemo(() => ({ gesture: Gesture.Native(), y: scrollY }), [scrollY]);

  // The Modal only fades, so the sheet slides itself; on close it continues from wherever the drag left it.
  useEffect(() => {
    ty.set(withTiming(visible ? 0 : height, SLIDE));
  }, [visible, ty, height]);

  // Follows the finger only while the SheetScrollView inside (if any) is at its top, so dragging down scrolls content first.
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(10)
        .simultaneousWithExternalGesture(scroll.gesture)
        .onStart((e) => from.set(e.translationY))
        .onUpdate((e) => {
          if (ty.get() === 0 && scrollY.get() > 0) return from.set(e.translationY);
          ty.set(Math.max(0, e.translationY - from.get()));
        })
        .onEnd((e) => {
          if (ty.get() > CLOSE_DISTANCE || (ty.get() > 0 && e.velocityY > CLOSE_VELOCITY)) scheduleOnRN(onClose);
          else ty.set(withSpring(0, SETTLE));
        }),
    [scroll, scrollY, ty, from, onClose],
  );

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.get() }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: interpolate(ty.get(), [0, height], [1, 0]) }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Gestures inside a Modal need their own root on Android. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.scrim, scrimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheet, { maxHeight, paddingBottom: Math.max(bottom, 12) + 12 }, sheetStyle]}>
            <View style={styles.handle} />
            <ScrollCtx.Provider value={scroll}>{children}</ScrollCtx.Provider>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Use for scrolling content inside a Sheet so drag-to-close waits until it is scrolled to the top. */
export function SheetScrollView(props: ScrollViewProps) {
  const { gesture, y } = useContext(ScrollCtx)!;
  const onScroll = useAnimatedScrollHandler((e) => y.set(e.contentOffset.y));
  return (
    <GestureDetector gesture={gesture}>
      <Animated.ScrollView {...props} bounces={false} onScroll={onScroll} scrollEventThrottle={16} />
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: {
    backgroundColor: Palette.card,
    borderTopWidth: 1,
    borderTopColor: Palette.border,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    paddingHorizontal: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.border,
    marginTop: 4,
    marginBottom: 16,
  },
});
