import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useAppTheme } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  onDemo?: () => void;
};

export function ErrorState({ message, onRetry, onDemo }: ErrorStateProps) {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <MaterialIcons name="error-outline" size={48} color={theme.colors.error} />
      <Text style={styles.title}>Ops, algo deu errado!</Text>
      <Text style={styles.message}>{message}</Text>
      
      <View style={styles.actions}>
        {onRetry && (
          <Pressable style={styles.btnPrimary} onPress={onRetry}>
            <Text style={styles.btnPrimaryText}>Tentar Novamente</Text>
          </Pressable>
        )}
        
        {onDemo && (
          <Pressable style={styles.btnSecondary} onPress={onDemo}>
            <Text style={styles.btnSecondaryText}>Modo Demonstração</Text>
          </Pressable>
        )}
      </View>
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
    color: theme.colors.error,
    marginTop: 16,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: theme.colors.mutedText,
    textAlign: 'center',
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  btnPrimary: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnPrimaryText: {
    color: theme.colors.surfaceLowest,
    fontSize: 14,
    fontWeight: 'bold',
  },
  btnSecondary: {
    backgroundColor: theme.colors.secondaryContainer,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnSecondaryText: {
    color: theme.colors.onSecondaryContainer,
    fontSize: 14,
    fontWeight: 'bold',
  }
});
