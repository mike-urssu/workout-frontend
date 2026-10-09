/** Colour and photo per body part (the API sends the name; matched by name in `styleOf`). */
export const GROUPS = [
  { id: 'chest', name: '가슴', color: '#b2e000', image: require('@/assets/images/groups/chest.jpg') },
  { id: 'back', name: '등', color: '#668aff', image: require('@/assets/images/groups/back.jpg') },
  { id: 'shoulders', name: '어깨', color: '#cc66ff', image: require('@/assets/images/groups/shoulders.jpg') },
  { id: 'legs', name: '하체', color: '#ff9933', image: require('@/assets/images/groups/legs.jpg') },
] as const;
