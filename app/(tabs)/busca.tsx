import { useSyncRevision } from '../../src/sync/revision';
import { View, Text, StyleSheet, FlatList, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { fetchConcursos, getDemoConcursos } from '../../src/api/client';
import { Concurso } from '../../src/types/concurso';
import { useAppTheme } from '../../src/theme';
import { ConcursoCard } from '../../src/components/ConcursoCard';
import { SearchInput } from '../../src/components/SearchInput';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';
import { EmptyState } from '../../src/components/EmptyState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { isRegistrationClosed, isRegistrationOpen } from '../../src/utils/registrationStatus';
import { concursoCargoNames, matchesCargo } from '../../src/utils/searchFilters';

type SearchFilters = {
  status: 'open' | 'closed' | null;
  banca: string | null;
  cargo: string | null;
  uf: string | null;
  area: string | null;
};

const initialFilters: SearchFilters = {
  status: null,
  banca: null,
  cargo: null,
  uf: null,
  area: null,
};

const normalize = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const uniqueOptions = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map(value => value?.trim()).filter(Boolean) as string[]))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

export default function Busca() {
  const syncRevision = useSyncRevision();
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [concursos, setConcursos] = useState<Concurso[]>([]);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
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
  }, [syncRevision]);

  const filterOptions = useMemo(() => ({
    bancas: uniqueOptions(concursos.map(concurso => concurso.banca)),
    cargos: uniqueOptions(concursos.flatMap(concurso => concursoCargoNames(concurso))),
    ufs: uniqueOptions(concursos.map(concurso => concurso.uf)),
    areas: uniqueOptions(concursos.map(concurso => concurso.area)),
  }), [concursos]);

  const filtered = useMemo(() => concursos.filter(concurso => {
    const term = normalize(query);
    const searchableFields = [
      concurso.titulo,
      concurso.orgao,
      concurso.banca,
      concurso.cargo,
      ...concursoCargoNames(concurso),
      concurso.area,
      concurso.cidade,
      concurso.uf,
      concurso.status,
    ];

    const matchesQuery = !term || searchableFields.some(field => normalize(field).includes(term));
    const matchesStatus = !filters.status || (filters.status === 'open'
      ? isRegistrationOpen(concurso)
      : isRegistrationClosed(concurso));
    const matchesBanca = !filters.banca || normalize(concurso.banca).includes(normalize(filters.banca));
    const cargoMatches = matchesCargo(concurso, filters.cargo);
    const matchesUf = !filters.uf || normalize(concurso.uf) === normalize(filters.uf);
    const matchesArea = !filters.area || normalize(concurso.area) === normalize(filters.area);

    return matchesQuery && matchesStatus && matchesBanca && cargoMatches && matchesUf && matchesArea;
  }), [concursos, filters, query]);

  const activeFilterCount = [filters.status, filters.banca, filters.cargo, filters.uf, filters.area]
    .filter(Boolean).length;

  const toggleQuickFilter = (key: 'status' | 'banca' | 'cargo' | 'uf', value: string) => {
    setFilters(current => ({
      ...current,
      [key]: current[key] === value ? null : value,
    } as SearchFilters));
  };

  const toggleOption = (key: 'banca' | 'cargo' | 'uf' | 'area', value: string) => {
    setFilters(current => ({ ...current, [key]: current[key] === value ? null : value }));
  };

  const clearFilters = () => setFilters(initialFilters);

  const renderFilterOption = (
    key: 'banca' | 'cargo' | 'uf' | 'area',
    value: string,
  ) => {
    const isSelected = filters[key] === value;
    return (
      <Pressable
        key={value}
        style={[styles.panelChip, isSelected && styles.panelChipSelected]}
        onPress={() => toggleOption(key, value)}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
      >
        <Text style={[styles.panelChipText, isSelected && styles.panelChipTextSelected]} numberOfLines={1}>
          {value}
        </Text>
      </Pressable>
    );
  };

  const renderItem = ({ item }: { item: Concurso }) => (
    <ConcursoCard item={item} />
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchContainerWrapper}>
          <SearchInput value={query} onChangeText={setQuery} placeholder="Órgão, cargo, local..." />
        </View>

        <View style={styles.filterToolbar}>
          <ScrollView style={styles.quickFiltersScroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
            <Pressable
              style={[styles.filterChip, filters.status === 'open' && styles.filterChipActive]}
              onPress={() => toggleQuickFilter('status', 'open')}
              accessibilityRole="button"
              accessibilityState={{ selected: filters.status === 'open' }}
            >
              <Text style={[styles.filterText, filters.status === 'open' && styles.filterTextActive]}>Abertas</Text>
            </Pressable>
            <Pressable
              style={[styles.filterChip, filters.banca === 'FGV' && styles.filterChipActive]}
              onPress={() => toggleQuickFilter('banca', 'FGV')}
              accessibilityRole="button"
              accessibilityState={{ selected: filters.banca === 'FGV' }}
            >
              <Text style={[styles.filterText, filters.banca === 'FGV' && styles.filterTextActive]}>FGV</Text>
            </Pressable>
            <Pressable
              style={[styles.filterChip, filters.cargo === 'Analista' && styles.filterChipActive]}
              onPress={() => toggleQuickFilter('cargo', 'Analista')}
              accessibilityRole="button"
              accessibilityState={{ selected: filters.cargo === 'Analista' }}
            >
              <Text style={[styles.filterText, filters.cargo === 'Analista' && styles.filterTextActive]}>Analista</Text>
            </Pressable>
            <Pressable
              style={[styles.filterChip, filters.uf === 'MG' && styles.filterChipActive]}
              onPress={() => toggleQuickFilter('uf', 'MG')}
              accessibilityRole="button"
              accessibilityState={{ selected: filters.uf === 'MG' }}
            >
              <Text style={[styles.filterText, filters.uf === 'MG' && styles.filterTextActive]}>MG</Text>
            </Pressable>
          </ScrollView>
          <Pressable
            style={[styles.filtersButton, showFilters && styles.filtersButtonActive]}
            onPress={() => setShowFilters(current => !current)}
            accessibilityRole="button"
            accessibilityLabel="Abrir filtros de busca"
            accessibilityState={{ expanded: showFilters }}
          >
            <MaterialIcons name="tune" size={18} color={showFilters ? theme.colors.surfaceLowest : theme.colors.primary} />
            <Text style={[styles.filtersButtonText, showFilters && styles.filterTextActive]}>Filtros</Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterCountBadge}>
                <Text style={styles.filterCountText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {showFilters && (
          <View style={styles.filterPanel}>
            <View style={styles.filterPanelHeader}>
              <Text style={styles.filterPanelTitle}>Filtrar resultados</Text>
              <Pressable onPress={clearFilters} disabled={activeFilterCount === 0}>
                <Text style={[styles.clearFiltersText, activeFilterCount === 0 && styles.disabledText]}>Limpar</Text>
              </Pressable>
            </View>

            <Text style={styles.filterSectionLabel}>SITUAÇÃO</Text>
            <View style={styles.panelChipRow}>
              <Pressable
                style={[styles.panelChip, !filters.status && styles.panelChipSelected]}
                onPress={() => setFilters(current => ({ ...current, status: null }))}
              >
                <Text style={[styles.panelChipText, !filters.status && styles.panelChipTextSelected]}>Todas</Text>
              </Pressable>
              <Pressable
                style={[styles.panelChip, filters.status === 'open' && styles.panelChipSelected]}
                onPress={() => toggleQuickFilter('status', 'open')}
              >
                <Text style={[styles.panelChipText, filters.status === 'open' && styles.panelChipTextSelected]}>Abertas</Text>
              </Pressable>
              <Pressable
                style={[styles.panelChip, filters.status === 'closed' && styles.panelChipSelected]}
                onPress={() => toggleQuickFilter('status', 'closed')}
              >
                <Text style={[styles.panelChipText, filters.status === 'closed' && styles.panelChipTextSelected]}>Encerradas</Text>
              </Pressable>
            </View>

            {filterOptions.bancas.length > 0 && (
              <>
                <Text style={styles.filterSectionLabel}>BANCA</Text>
                <View style={styles.panelChipRow}>
                  <Pressable
                    style={[styles.panelChip, !filters.banca && styles.panelChipSelected]}
                    onPress={() => setFilters(current => ({ ...current, banca: null }))}
                  >
                    <Text style={[styles.panelChipText, !filters.banca && styles.panelChipTextSelected]}>Todas</Text>
                  </Pressable>
                  {filterOptions.bancas.map(value => renderFilterOption('banca', value))}
                </View>
              </>
            )}

            {filterOptions.ufs.length > 0 && (
              <>
                <Text style={styles.filterSectionLabel}>ESTADO</Text>
                <View style={styles.panelChipRow}>
                  <Pressable
                    style={[styles.panelChip, !filters.uf && styles.panelChipSelected]}
                    onPress={() => setFilters(current => ({ ...current, uf: null }))}
                  >
                    <Text style={[styles.panelChipText, !filters.uf && styles.panelChipTextSelected]}>Todos</Text>
                  </Pressable>
                  {filterOptions.ufs.map(value => renderFilterOption('uf', value))}
                </View>
              </>
            )}

            {filterOptions.areas.length > 0 && (
              <>
                <Text style={styles.filterSectionLabel}>ÁREA</Text>
                <View style={styles.panelChipRow}>
                  <Pressable
                    style={[styles.panelChip, !filters.area && styles.panelChipSelected]}
                    onPress={() => setFilters(current => ({ ...current, area: null }))}
                  >
                    <Text style={[styles.panelChipText, !filters.area && styles.panelChipTextSelected]}>Todas</Text>
                  </Pressable>
                  {filterOptions.areas.map(value => renderFilterOption('area', value))}
                </View>
              </>
            )}

            {filterOptions.cargos.length > 0 && (
              <>
                <Text style={styles.filterSectionLabel}>CARGO</Text>
                <View style={styles.panelChipRow}>
                  <Pressable
                    style={[styles.panelChip, !filters.cargo && styles.panelChipSelected]}
                    onPress={() => setFilters(current => ({ ...current, cargo: null }))}
                  >
                    <Text style={[styles.panelChipText, !filters.cargo && styles.panelChipTextSelected]}>Todos</Text>
                  </Pressable>
                  {filterOptions.cargos.map(value => renderFilterOption('cargo', value))}
                </View>
              </>
            )}
          </View>
        )}
      </View>

      {!loading && !error && (
        <View style={styles.resultsHeader}>
          <View>
            <Text style={styles.resultsLabel}>RESULTADOS ENCONTRADOS</Text>
            <Text style={styles.resultsCount}>{filtered.length} Seleções</Text>
          </View>
          {activeFilterCount > 0 && <Text style={styles.activeFiltersText}>{activeFilterCount} filtro(s) ativo(s)</Text>}
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
          ListEmptyComponent={<EmptyState title="Sem resultados" message="Tente mudar os termos ou limpar os filtros." />}
        />
      )}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  header: { padding: 24, paddingTop: 64, backgroundColor: theme.colors.surfaceLowest, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, zIndex: 10, paddingBottom: 16 },
  searchContainerWrapper: { marginBottom: 12 },
  filterToolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickFiltersScroll: { flex: 1 },
  filtersScroll: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  filterChip: { backgroundColor: theme.colors.surfaceHighest, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.surfaceHighest },
  filterChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterText: { color: theme.colors.primary, fontSize: 12, fontWeight: 'bold' },
  filterTextActive: { color: theme.colors.surfaceLowest },
  filtersButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.surfaceHighest, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.surfaceHighest },
  filtersButtonActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filtersButtonText: { color: theme.colors.primary, fontSize: 12, fontWeight: 'bold' },
  filterCountBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: theme.colors.onTertiaryContainer, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterCountText: { color: theme.colors.primary, fontSize: 10, fontWeight: '900' },
  filterPanel: { marginTop: 16, padding: 16, borderRadius: 14, backgroundColor: theme.colors.surfaceLow, borderWidth: 1, borderColor: theme.colors.surfaceHighest },
  filterPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  filterPanelTitle: { color: theme.colors.primary, fontSize: 16, fontWeight: 'bold' },
  clearFiltersText: { color: theme.colors.error, fontSize: 12, fontWeight: 'bold' },
  disabledText: { opacity: 0.45 },
  filterSectionLabel: { color: theme.colors.mutedText, fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  panelChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  panelChip: { maxWidth: '100%', backgroundColor: theme.colors.surfaceLowest, borderWidth: 1, borderColor: theme.colors.surfaceHighest, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14 },
  panelChipSelected: { backgroundColor: theme.colors.secondaryContainer, borderColor: theme.colors.primary },
  panelChipText: { color: theme.colors.text, fontSize: 12, fontWeight: '600' },
  panelChipTextSelected: { color: theme.colors.primary, fontWeight: 'bold' },
  resultsHeader: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  resultsLabel: { fontSize: 10, fontWeight: 'bold', color: theme.colors.primary, letterSpacing: 1, opacity: 0.6, marginBottom: 4 },
  resultsCount: { fontSize: 28, fontWeight: '900', color: theme.colors.primary },
  activeFiltersText: { color: theme.colors.mutedText, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  listContent: { padding: 24, paddingBottom: 100 },
});
