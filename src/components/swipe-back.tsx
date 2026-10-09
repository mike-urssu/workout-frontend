import { ReactNode, useMemo } from 'react';
import { PanResponder, Platform, StyleSheet, View } from 'react-native';

const EDGE = 40; // the swipe has to start at the left edge, like the iOS back gesture
const DISTANCE = 80;

/** iOS-style "swipe right from the left edge to go back" for screens inside the tab navigator (which has no such gesture). */
export function SwipeBack({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  const pan = useMemo(
    () =>
      PanResponder.create({
        // capture so the ScrollView / inputs underneath do not swallow a horizontal edge drag
        onMoveShouldSetPanResponderCapture: (_, g) => g.x0 < EDGE && g.dx > 12 && g.dx > Math.abs(g.dy) * 2,
        onPanResponderRelease: (_, g) => {
          if (g.dx > DISTANCE || g.vx > 0.6) onBack();
        },
      }),
    [onBack],
  );

  if (Platform.OS !== 'ios') return <>{children}</>; // Android has the system back gesture
  return <View style={styles.fill} {...pan.panHandlers}>{children}</View>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
