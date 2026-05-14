import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../theme';

export function StatusBadge({ status }: { status: string | undefined | null }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const label = status || 'NÃO INFORMADO';
  
  return (
    <View style={styles.badge}>
       <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  badge: {
    backgroundColor: theme.colors.secondaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: theme.colors.onSecondaryContainer,
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  }
});
