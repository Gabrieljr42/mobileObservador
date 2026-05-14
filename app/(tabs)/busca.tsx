import { View, Text, StyleSheet, FlatList, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { fetchConcursos, getDemoConcursos } from '../../src/api/client';
import { Concurso } from '../../src/types/concurso';
import { useAppTheme } from '../../src/theme';
import { ConcursoCard } from '../../src/components/ConcursoCard';
import { SearchInput } from '../../src/components/SearchInput';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';
import { EmptyState } from '../../src/components/EmptyState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Busca() {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [concursos, setConcursos] = useState<Concurso[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (useDemo = false) => {
    setLoading(true);
    setError(null);
    try {
      if (useDemo) {
        setConcursos(getDemoConcursos());
      } else {
        const data = await fetchConcursos();
        setConcursos(data);
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = concursos.filter(c => {
    if (!query) return true;
    const term = query.toLowerCase();
    return (
      c.titulo?.toLowerCase().includes(term) || 
      c.orgao?.toLowerCase().includes(term) ||
      c.banca?.toLowerCase().includes(term) ||
      c.cargo?.toLowerCase().includes(term) ||
      c.area?.toLowerCase().includes(term) ||
      c.cidade?.toLowerCase().includes(term) ||
      c.uf?.toLowerCase().includes(term) ||
      c.status?.toLowerCase().includes(term)
    );
  });

  const renderItem = ({ item }: { item: Concurso }) => (
    <ConcursoCard item={item} />
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchContainerWrapper}>
          <SearchInput value={query} onChangeText={setQuery} placeholder="Órgão, cargo, local..." />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          <Pressable style={styles.filterChip} onPress={() => setQuery('abertas')}><Text style={styles.filterText}>Abertas</Text></Pressable>
          <Pressable style={styles.filterChip} onPress={() => setQuery('fgv')}><Text style={styles.filterText}>FGV</Text></Pressable>
          <Pressable style={styles.filterChip} onPress={() => setQuery('analista')}><Text style={styles.filterText}>Analista</Text></Pressable>
          <Pressable style={styles.filterChip} onPress={() => setQuery('mg')}><Text style={styles.filterText}>MG</Text></Pressable>
        </ScrollView>
      </View>
      
      {!loading && !error && (
        <View style={styles.resultsHeader}>
           <View>
             <Text style={styles.resultsLabel}>RESULTADOS ENCONTRADOS</Text>
             <Text style={styles.resultsCount}>{filtered.length} Vagas</Text>
           </View>
        </View>
      )}

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => loadData(false)} onDemo={() => loadData(true)} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
          ListEmptyComponent={<EmptyState title="Sem resultados" message="Tente buscar por outras palavras." />}
        />
      )}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  header: { padding: 24, paddingTop: 64, backgroundColor: theme.colors.surfaceLowest, elevation: 4, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.05, shadowRadius: 10, zIndex: 10, paddingBottom: 16 },
  searchContainerWrapper: { marginBottom: 12 },
  filtersScroll: { flexDirection: 'row', gap: 8 },
  filterChip: { backgroundColor: theme.colors.surfaceHighest, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.surfaceHighest },
  filterText: { color: theme.colors.primary, fontSize: 12, fontWeight: 'bold' },
  resultsHeader: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  resultsLabel: { fontSize: 10, fontWeight: 'bold', color: theme.colors.primary, letterSpacing: 1, opacity: 0.6, marginBottom: 4 },
  resultsCount: { fontSize: 28, fontWeight: '900', color: theme.colors.primary },
  listContent: { padding: 24, paddingBottom: 100 },
});
