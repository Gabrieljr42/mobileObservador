import { useSyncRevision } from '../../src/sync/revision';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { Concurso } from '../../src/types/concurso';
import { getFavorites as getRealFavorites, removeFavorite } from '../../src/api/favorites';
import { useAppTheme } from '../../src/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { ConcursoCard } from '../../src/components/ConcursoCard';
import { EmptyState } from '../../src/components/EmptyState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';

export default function Salvos() {
  const syncRevision = useSyncRevision();
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [favorites, setFavorites] = useState<Concurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFavs = async () => {
    setLoading(true);
    setError(null);
    try {
      // The first screen can race the initial SQLite checkpoint transaction.
      // A short read retry keeps a transient lock from becoming a visible error.
      let favs: Concurso[] | undefined;
      let lastError: unknown;
      // SQLite can hold the read briefly while the initial checkpoint commits.
      // Retry the read itself; only surface an error after the transaction
      // window has closed and all attempts failed.
      for (const delay of [0, 120, 300, 600]) {
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        try {
          favs = await getRealFavorites();
          break;
        } catch (cause) {
          lastError = cause;
        }
      }
      if (!favs) throw lastError || new Error('Favoritos indisponíveis');
      setFavorites(favs);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao carregar favoritos.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFavs();
    }, [syncRevision])
  );

  const removeSaved = async (id: number) => {
    try {
      await removeFavorite(id);
      setFavorites(current => current.filter(item => item.id !== id));
    } catch {
      Alert.alert('Erro', 'Não foi possível remover dos salvos.');
    }
  };

  const renderItem = ({ item }: { item: Concurso }) => (
    <ConcursoCard item={item} inSaved={true} onRemoveFavorite={removeSaved} />
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Salvos</Text>
          <Text style={styles.countText}>{favorites.length} itens salvos</Text>
        </View>
        <Text style={styles.subtitle}>Gerencie suas oportunidades favoritas e acompanhe prazos de inscrição.</Text>
      </View>

      {loading ? (
        <LoadingState message="Carregando favoritos..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadFavs} />
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <EmptyState title="Quer ver mais?" message="Continue explorando novas vagas que combinam com seu perfil." />
               <Pressable style={styles.exploreBtn} onPress={() => router.push('/(tabs)/busca')}>
                 <Text style={styles.exploreBtnText}>Explorar Oportunidades</Text>
                 <MaterialIcons name="arrow-forward" size={16} color={theme.colors.primary} />
               </Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  header: { padding: 24, paddingTop: 64, backgroundColor: theme.colors.surfaceLowest, elevation: 4, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.05, shadowRadius: 10, zIndex: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  title: { fontSize: 36, fontWeight: '900', color: theme.colors.primary },
  countText: { fontSize: 14, fontWeight: 'bold', color: theme.colors.mutedText },
  subtitle: { fontSize: 16, color: theme.colors.mutedText, lineHeight: 24 },
  listContent: { padding: 24, paddingBottom: 100 },
  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', padding: 16, borderWidth: 2, borderColor: theme.colors.surfaceHighest, borderStyle: 'dashed', borderRadius: 24, marginTop: 32 },
  exploreBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, padding: 12 },
  exploreBtnText: { fontSize: 14, fontWeight: 'bold', color: theme.colors.primary }
});
