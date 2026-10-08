export type MuscleGroupId = 'chest' | 'back' | 'shoulders' | 'legs';

export const GROUPS = [
  { id: 'chest', name: '가슴', color: '#b2e000', image: require('@/assets/images/groups/chest.jpg') },
  { id: 'back', name: '등', color: '#668aff', image: require('@/assets/images/groups/back.jpg') },
  { id: 'shoulders', name: '어깨', color: '#cc66ff', image: require('@/assets/images/groups/shoulders.jpg') },
  { id: 'legs', name: '하체', color: '#ff9933', image: require('@/assets/images/groups/legs.jpg') },
] as const;

export type Exercise = {
  id: string;
  group: MuscleGroupId;
  name: string;
  en: string;
  target: string;
  /** starting weight used only by the dummy seed data */
  baseKg: number;
};

export const EXERCISES: Exercise[] = [
  { id: 'bench-press', group: 'chest', name: '벤치프레스', en: 'Bench Press', target: '가슴 중부 타겟', baseKg: 60 },
  { id: 'incline-bench', group: 'chest', name: '인클라인 벤치프레스', en: 'Incline Bench Press', target: '가슴 상부 타겟', baseKg: 50 },
  { id: 'dumbbell-fly', group: 'chest', name: '덤벨 플라이', en: 'Dumbbell Fly', target: '가슴 안쪽 타겟', baseKg: 14 },
  { id: 'cable-crossover', group: 'chest', name: '케이블 크로스오버', en: 'Cable Crossover', target: '가슴 하부 타겟', baseKg: 20 },
  { id: 'pec-deck', group: 'chest', name: '펙덱 플라이', en: 'Pec Deck Fly', target: '가슴 안쪽 타겟', baseKg: 40 },
  { id: 'lat-pulldown', group: 'back', name: '랫풀다운', en: 'Lat Pulldown', target: '광배근 타겟', baseKg: 50 },
  { id: 'seated-row', group: 'back', name: '시티드 로우', en: 'Seated Row', target: '등 중부 타겟', baseKg: 45 },
  { id: 'barbell-row', group: 'back', name: '바벨 로우', en: 'Barbell Row', target: '등 전체 타겟', baseKg: 50 },
  { id: 'one-arm-row', group: 'back', name: '원암 덤벨 로우', en: 'One-arm Dumbbell Row', target: '광배근 타겟', baseKg: 20 },
  { id: 'shoulder-press', group: 'shoulders', name: '숄더프레스', en: 'Shoulder Press', target: '어깨 전면 타겟', baseKg: 40 },
  { id: 'lateral-raise', group: 'shoulders', name: '사이드 레터럴 레이즈', en: 'Side Lateral Raise', target: '어깨 측면 타겟', baseKg: 8 },
  { id: 'face-pull', group: 'shoulders', name: '페이스 풀', en: 'Face Pull', target: '어깨 후면 타겟', baseKg: 20 },
  { id: 'rear-delt-fly', group: 'shoulders', name: '리어 델트 플라이', en: 'Rear Delt Fly', target: '어깨 후면 타겟', baseKg: 10 },
  { id: 'squat', group: 'legs', name: '스쿼트', en: 'Squat', target: '대퇴사두 타겟', baseKg: 80 },
  { id: 'leg-press', group: 'legs', name: '레그 프레스', en: 'Leg Press', target: '대퇴사두 타겟', baseKg: 120 },
  { id: 'leg-extension', group: 'legs', name: '레그 익스텐션', en: 'Leg Extension', target: '대퇴사두 타겟', baseKg: 40 },
  { id: 'leg-curl', group: 'legs', name: '레그 컬', en: 'Leg Curl', target: '햄스트링 타겟', baseKg: 35 },
  { id: 'romanian-deadlift', group: 'legs', name: '루마니안 데드리프트', en: 'Romanian Deadlift', target: '햄스트링 타겟', baseKg: 60 },
];

export const groupById = (id: string) => GROUPS.find((g) => g.id === id)!;
export const exerciseById = (id: string) => EXERCISES.find((e) => e.id === id)!;
export const exercisesOf = (group: string) => EXERCISES.filter((e) => e.group === group);
