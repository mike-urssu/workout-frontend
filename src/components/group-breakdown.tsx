import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GROUPS, exerciseById } from '@/data/catalog';
import { Font, Palette } from '@/constants/theme';
import {
  SessionExercise, doneSets, exerciseVolume, groupOf, kg, totalSets, totalVolume,
} from '@/data/workout';

/** Per muscle group card: collapsed = exercise summary rows, expanded = every set. */
export function GroupBreakdown({ exercises, bg }: { exercises: SessionExercise[]; bg: string }) {
  const groups = GROUPS.map((g) => ({
    g,
    items: exercises.filter((e) => groupOf(e) === g.id && doneSets(e).length),
  })).filter((x) => x.items.length);

  return (
    <View style={styles.list}>
      {groups.map(({ g, items }) => (
        <GroupCard key={g.id} name={g.name} items={items} bg={bg} />
      ))}
    </View>
  );
}

function GroupCard({ name, items, bg }: { name: string; items: SessionExercise[]; bg: string }) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      <Pressable style={styles.header} onPress={() => setOpen(!open)}>
        <View style={{ gap: 2 }}>
          <Text style={styles.groupName}>{name}</Text>
          <Text style={styles.summary}>{`${kg(totalVolume(items))}kg · ${totalSets(items)}세트`}</Text>
        </View>
        <Chevron size={16} color="rgba(255,255,255,0.8)" />
      </Pressable>
      {items.map((e) => (
        <View key={e.exerciseId} style={[styles.exercise, open && styles.divided]}>
          <View style={styles.exerciseRow}>
            <Text style={styles.exerciseName}>{exerciseById(e.exerciseId).name}</Text>
            <Text style={styles.summary}>{`${kg(exerciseVolume(e))}kg · ${doneSets(e).length}세트`}</Text>
          </View>
          {open &&
            doneSets(e).map((s, i) => (
              <Text key={s.id} style={styles.setLine}>{`${i + 1}세트 ${s.weight ?? 0}kg × ${s.reps}회`}</Text>
            ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: { borderWidth: 1, borderColor: Palette.border, borderRadius: 14, padding: 12, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  groupName: { fontFamily: Font.manrope.extrabold, fontSize: 16, color: '#fff' },
  summary: { fontFamily: Font.manrope.regular, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  exercise: { gap: 6 },
  divided: { borderTopWidth: 1, borderTopColor: Palette.border, paddingTop: 10 },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exerciseName: { fontFamily: Font.outfit.semibold, fontSize: 15, color: '#fff' },
  setLine: { fontFamily: Font.manrope.regular, fontSize: 12, color: 'rgba(255,255,255,0.5)' },
});
