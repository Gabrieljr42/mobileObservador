import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { useAppTheme } from '../../src/theme';
import { useAuth } from '../../src/providers/AuthProvider';
import { MaterialIcons } from '@expo/vector-icons';
import { getRecentUpdates, getMyUpdates, ConcursoUpdate } from '../../src/api/updates';
import { UpdateCard } from '../../src/components/UpdateCard';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';
import { EmptyState } from '../../src/components/EmptyState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AtualizacoesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [updates, setUpdates] = useState<ConcursoUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUpdates = async () => {
    try {
      setError(null);
      if (user) {
        try {
          const data = await getMyUpdates(20);
          setUpdates(data);
          return;
        } catch (e: any) {
          // fallback to recent updates if personal updates fail
          console.warn('Failed to fetch personal updates, falling back to recent.', e);
        }
      }
      
      const data = await getRecentUpdates(20);
      setUpdates(data);
    } catch (err: any) {
      setError('Não foi possível carregar as atualizações no momento.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
  }, [user]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUpdates();
  }, [user]);

  if (loading) {
    return <LoadingState message="Buscando atualizações..." />;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Atualizações</Text>
      </View>
      
      {error ? (
        <ErrorState message={error} onRetry={fetchUpdates} />
      ) : updates.length === 0 ? (
        <EmptyState 
          icon="radar" 
          title="Nenhuma atualização" 
          message="Não encontramos atualizações recentes nos concursos acompanhados."
        />
      ) : (
        <ScrollView 
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        >
          {updates.map(update => (
            <UpdateCard 
              key={update.id.toString()} 
              update={update} 
              onPress={() => router.push(`/concurso/${update.concurso_id}`)} 
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  header: { 
    paddingHorizontal: 24, 
    paddingBottom: 16, 
    backgroundColor: theme.colors.surfaceLowest, 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOffset: {width: 0, height: 4}, 
    shadowOpacity: 0.05, 
    shadowRadius: 10, 
    zIndex: 10 
  },
  title: { fontSize: 24, fontWeight: '900', color: theme.colors.primary },
  content: { padding: 24 },
});
