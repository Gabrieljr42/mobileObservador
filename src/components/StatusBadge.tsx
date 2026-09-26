import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../theme';
import type { RegistrationSituation } from '../utils/registrationStatus';

const derivedLabels: Record<Exclude<RegistrationSituation, 'unknown'>, string> = {
  open: 'INSCRIÇÕES ABERTAS',
  upcoming: 'INSCRIÇÕES EM BREVE',
  closed: 'ENCERRADO',
};

export function StatusBadge({
  status,
  situation,
}: {
  status: string | undefined | null;
  situation?: RegistrationSituation;
}) {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const label = situation && situation !== 'unknown'
    ? derivedLabels[situation]
    : status || 'NÃO INFORMADO';
  
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
