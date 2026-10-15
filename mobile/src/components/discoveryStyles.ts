import { StyleSheet } from 'react-native';
import { colors, layout, radius, space, type } from '../theme';

export const discoveryStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.gutter, paddingBottom: space.huge, gap: space.lg },
  section: { gap: space.md },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  title: { ...type.h1 },
  heading: { ...type.h3 },
  strong: { ...type.bodyStrong },
  body: { ...type.body },
  meta: { ...type.secondary },
  price: { ...type.price, color: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  photo: { width: 260, height: 180, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
});
