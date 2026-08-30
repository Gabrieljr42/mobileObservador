import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';

export function EmptyState({ title = 'Nenhum resultado', message = 'Não encontramos dados para exibir no momento.', icon = 'inbox' }: { title?: string, message?: string, icon?: keyof typeof MaterialIcons.glyphMap }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <MaterialIcons name={icon as any} size={48} color={theme.colors.mutedText} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: theme.colors.mutedText,
    textAlign: 'center',
  }
});
