import { ReactNode, RefObject, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  ReduceMotion, SharedValue, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const SETTLE = { duration: 400, dampingRatio: 0.8, reduceMotion: ReduceMotion.System };

type Props<T> = {
  data: T[];
  keyOf: (item: T) => string;
  /** Rows must be exactly this tall: they are positioned absolutely, one step (height + gap) apart. */
  itemHeight: number;
  gap: number;
  /** The enclosing gesture-handler ScrollView, so it waits while a handle is dragged. */
  scrollRef: RefObject<React.ComponentType | null>;
  /** `handle` is the draggable area; place it inside the row. */
  renderItem: (item: T, handle: (children: ReactNode) => ReactNode) => ReactNode;
  /** Called on drop when the order changed, with the keys in their new order. */
  onReorder: (keys: string[]) => void;
  /** e.g. while the previous order is being saved */
  disabled?: boolean;
};

/** Drag-to-reorder for a short list of fixed-height rows (no auto-scroll while dragging). */
export function SortableList<T>({ data, keyOf, itemHeight, gap, scrollRef, renderItem, onReorder, disabled = false }: Props<T>) {
  const keys = data.map(keyOf);
  const order = useSharedValue(keys);
  const joined = keys.join();
  useEffect(() => {
    order.set(joined ? joined.split(',') : []);
  }, [joined, order]);

  return (
    <View style={{ height: Math.max(0, data.length * (itemHeight + gap) - gap) }}>
      {data.map((item, i) => (
        <Row
          key={keys[i]}
          id={keys[i]}
          index={i}
          order={order}
          height={itemHeight}
          step={itemHeight + gap}
          scrollRef={scrollRef}
          onReorder={onReorder}
          disabled={disabled}>
          {(handle) => renderItem(item, handle)}
        </Row>
      ))}
    </View>
  );
}

type RowProps = {
  id: string;
  index: number;
  order: SharedValue<string[]>;
  height: number;
  step: number;
  scrollRef: Props<unknown>['scrollRef'];
  onReorder: (keys: string[]) => void;
  disabled: boolean;
  children: (handle: (children: ReactNode) => ReactNode) => ReactNode;
};

function Row({ id, index, order, height, step, scrollRef, onReorder, disabled, children }: RowProps) {
  const y = useSharedValue(index * step);
  const dragging = useSharedValue(false);
  const from = useSharedValue(0);

  // Slide into the new slot when another row is dragged past this one (or a row above is removed).
  useAnimatedReaction(
    () => order.get().indexOf(id),
    (i, prev) => {
      if (i !== prev && i >= 0 && !dragging.get()) y.set(withSpring(i * step, SETTLE));
    },
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .blocksExternalGesture(scrollRef)
        .onStart(() => {
          dragging.set(true);
          from.set(order.get().indexOf(id));
        })
        .onUpdate((e) => {
          const last = order.get().length - 1;
          const top = Math.min(Math.max(from.get() * step + e.translationY, 0), last * step);
          y.set(top);
          const to = Math.round(top / step);
          const now = order.get().indexOf(id);
          if (to !== now) {
            const next = order.get().slice();
            next.splice(now, 1);
            next.splice(to, 0, id);
            order.set(next);
          }
        })
        .onFinalize(() => {
          if (!dragging.get()) return;
          dragging.set(false);
          const to = order.get().indexOf(id);
          y.set(withSpring(to * step, SETTLE));
          if (to !== from.get()) scheduleOnRN(onReorder, order.get());
        }),
    [id, order, step, scrollRef, onReorder, disabled, y, dragging, from],
  );

  const style = useAnimatedStyle(() => ({
    zIndex: dragging.get() ? 1 : 0,
    transform: [{ translateY: y.get() }],
  }));

  const handle = (content: ReactNode) => (
    <GestureDetector gesture={pan}>
      <View>{content}</View>
    </GestureDetector>
  );

  return <Animated.View style={[styles.row, { height }, style]}>{children(handle)}</Animated.View>;
}

const styles = StyleSheet.create({ row: { position: 'absolute', left: 0, right: 0 } });
