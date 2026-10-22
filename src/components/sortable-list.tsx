import { ReactNode, RefObject, useCallback, useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  AnimatedRef, measure, ReduceMotion, scrollTo, SharedValue, useAnimatedReaction, useAnimatedRef, useAnimatedStyle,
  useFrameCallback, useScrollOffset, useSharedValue, withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const SETTLE = { duration: 400, dampingRatio: 0.8, reduceMotion: ReduceMotion.System };
/** A dragged row this close to the top or bottom of the scroll view scrolls it, faster the closer it gets. */
const EDGE = 80;
const MAX_SPEED = 12; // per frame

type Props<T> = {
  data: T[];
  keyOf: (item: T) => string;
  /** Rows must be exactly this tall: they are positioned absolutely, one step (height + gap) apart. */
  itemHeight: number;
  gap: number;
  /** The enclosing gesture-handler ScrollView: it waits while a handle is dragged, and follows a row dragged to its edge. */
  scrollRef: AnimatedRef<ScrollView>;
  /** `handle` is the draggable area; place it inside the row. */
  renderItem: (item: T, handle: (children: ReactNode) => ReactNode) => ReactNode;
  /** Called on drop when the order changed, with the keys in their new order. */
  onReorder: (keys: string[]) => void;
  /** e.g. while the previous order is being saved */
  disabled?: boolean;
};

/** Drag-to-reorder for a short list of fixed-height rows. */
export function SortableList<T>({ data, keyOf, itemHeight, gap, scrollRef, renderItem, onReorder, disabled = false }: Props<T>) {
  const keys = data.map(keyOf);
  const order = useSharedValue(keys);
  const joined = keys.join();
  useEffect(() => {
    order.set(joined ? joined.split(',') : []);
  }, [joined, order]);
  const listRef = useAnimatedRef<View>();
  const scroll = useScrollOffset(scrollRef);

  return (
    <View ref={listRef} style={{ height: Math.max(0, data.length * (itemHeight + gap) - gap) }}>
      {data.map((item, i) => (
        <Row
          key={keys[i]}
          id={keys[i]}
          index={i}
          order={order}
          height={itemHeight}
          step={itemHeight + gap}
          scrollRef={scrollRef}
          listRef={listRef}
          scroll={scroll}
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
  listRef: AnimatedRef<View>;
  scroll: SharedValue<number>;
  onReorder: (keys: string[]) => void;
  disabled: boolean;
  children: (handle: (children: ReactNode) => ReactNode) => ReactNode;
};

function Row({ id, index, order, height, step, scrollRef, listRef, scroll, onReorder, disabled, children }: RowProps) {
  const y = useSharedValue(index * step);
  const dragging = useSharedValue(false);
  const from = useSharedValue(0);
  const dy = useSharedValue(0); // finger movement
  const base = useSharedValue(0); // scroll offset when the drag started
  const scrolled = useSharedValue(0); // auto-scroll since then; kept here because the scroll offset arrives a frame late

  // Follows the finger (plus any auto-scroll) and moves the row into the slot it is over.
  const move = useCallback(() => {
    'worklet';
    const last = order.get().length - 1;
    const top = Math.min(Math.max(from.get() * step + dy.get() + scrolled.get(), 0), last * step);
    y.set(top);
    const to = Math.round(top / step);
    const now = order.get().indexOf(id);
    if (to !== now) {
      const next = order.get().slice();
      next.splice(now, 1);
      next.splice(to, 0, id);
      order.set(next);
    }
  }, [id, order, step, y, from, dy, scrolled]);

  const { setActive: setAutoScroll } = useFrameCallback(() => {
    if (!dragging.get()) return; // switching off lands a frame late
    const view = measure(scrollRef);
    const list = measure(listRef);
    if (!view || !list) return;
    const top = list.pageY + y.get() - view.pageY; // row top inside the scroll view
    const over = top < EDGE ? top - EDGE : top + height > view.height - EDGE ? top + height - (view.height - EDGE) : 0;
    const last = (order.get().length - 1) * step;
    if ((over < 0 && y.get() <= 0) || (over > 0 && y.get() >= last)) return; // already at the end of the list
    const by = Math.max(Math.min(over / 4, MAX_SPEED), -MAX_SPEED, -(base.get() + scrolled.get())); // never above the top
    if (!by) return;
    scrolled.set(scrolled.get() + by);
    scrollTo(scrollRef, 0, base.get() + scrolled.get(), false);
    move();
  }, false);

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
        .blocksExternalGesture(scrollRef as unknown as RefObject<React.ComponentType>) // the types want a component; the ref's instance carries the handlerTag
        .onStart(() => {
          dragging.set(true);
          from.set(order.get().indexOf(id));
          dy.set(0);
          base.set(scroll.get());
          scrolled.set(0);
          scheduleOnRN(setAutoScroll, true);
        })
        .onUpdate((e) => {
          dy.set(e.translationY);
          move();
        })
        .onFinalize(() => {
          if (!dragging.get()) return;
          dragging.set(false);
          scheduleOnRN(setAutoScroll, false);
          const to = order.get().indexOf(id);
          y.set(withSpring(to * step, SETTLE));
          if (to !== from.get()) scheduleOnRN(onReorder, order.get());
        }),
    [id, order, step, scrollRef, scroll, onReorder, disabled, y, dragging, from, dy, base, scrolled, setAutoScroll, move],
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
