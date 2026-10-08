import { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';

type Props = { visible: boolean; onClose: () => void; maxHeight?: `${number}%`; children: ReactNode };

/** Bottom sheet with a dimmed scrim (workout-complete / today-workout popups). */
export function Sheet({ visible, onClose, maxHeight = '90%', children }: Props) {
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={[styles.sheet, { maxHeight, paddingBottom: Math.max(bottom, 12) + 12 }]}>
          <View style={styles.handle} />
          {children}
        </View>
      </View>
    </Modal>
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
