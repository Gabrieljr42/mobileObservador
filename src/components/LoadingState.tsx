import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useAppTheme } from '../theme';

export function LoadingState({ message = 'Carregando...'}: { message?: string }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 16,
    fontSize: 14,
    color: theme.colors.mutedText,
    fontWeight: '500',
  }
});
