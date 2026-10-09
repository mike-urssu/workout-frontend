import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Breakdown } from '@/api/workout';
import { Font, Palette } from '@/constants/theme';
import { kg } from '@/data/workout';

/** Per muscle group card: collapsed = exercise summary rows, expanded = every set. */
export function GroupBreakdown({ groups, bg }: { groups: Breakdown; bg: string }) {
  return (
    <View style={styles.list}>
      {groups.map((g) => (
        <GroupCard key={g.id} group={g} bg={bg} />
      ))}
    </View>
  );
}

function GroupCard({ group, bg }: { group: Breakdown[number]; bg: string }) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      <Pressable style={styles.header} onPress={() => setOpen(!open)}>
        <View style={{ gap: 2 }}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.summary}>{`${kg(group.volume)}kg · ${group.setCount}세트`}</Text>
        </View>
        <Chevron size={16} color="rgba(255,255,255,0.8)" />
      </Pressable>
      {group.exercises.map((e) => (
        <View key={e.key} style={[styles.exercise, open && styles.divided]}>
          <View style={styles.exerciseRow}>
            <Text style={styles.exerciseName}>{e.name}</Text>
            <Text style={styles.summary}>{`${kg(e.volume)}kg · ${e.setCount}세트`}</Text>
          </View>
          {open &&
            e.sets.map((s, i) => (
              <Text key={i} style={styles.setLine}>{`${i + 1}세트 ${s.weight}kg × ${s.repetitions}회`}</Text>
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
