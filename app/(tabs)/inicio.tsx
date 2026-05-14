import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../src/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState, useRef } from 'react';
import { fetchConcursos, getDemoConcursos } from '../../src/api/client';
import { Concurso } from '../../src/types/concurso';
import { ConcursoCard } from '../../src/components/ConcursoCard';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';
import { EmptyState } from '../../src/components/EmptyState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/providers/AuthProvider';

export default function Dashboard() {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const [concursos, setConcursos] = useState<Concurso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const loadData = async (useDemo = false) => {
    setLoading(true);
    setError(null);
    try {
      if (useDemo) {
        setConcursos(getDemoConcursos());
        setIsDemo(true);
      } else {
        const data = await fetchConcursos();
        setConcursos(data);
        setIsDemo(false);
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

  const handleLogout = async () => {
    setIsMenuOpen(false);
    await logout();
  };

  const navTo = (route: string) => {
    setIsMenuOpen(false);
    router.push(route as any);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => setIsMenuOpen(true)} hitSlop={10}>
            <MaterialIcons name="menu" size={24} color={theme.colors.primary} />
          </Pressable>
          <Text style={styles.appTitle}>RadarConcursos</Text>
          <Pressable onPress={() => router.push('/notificacoes')} hitSlop={10}>
            <MaterialIcons name="notifications" size={24} color={theme.colors.primary} />
          </Pressable>
        </View>
        <Text style={styles.greeting}>Olá, concurseiro!</Text>
        <Text style={styles.subtitle}>Mantenha o foco. Sua aprovação está mais próxima hoje.</Text>
        {isDemo && (
          <View style={styles.demoBadge}>
            <Text style={styles.demoText}>MODO DEMONSTRAÇÃO</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}>
        {!loading && !error && (
          <View style={styles.statsGrid}>
             <View style={[styles.statBox, { backgroundColor: theme.colors.primary }]}>
               <View style={styles.statRow}>
                  <MaterialIcons name="new-releases" size={32} color={theme.colors.surfaceLowest} />
                  <Text style={styles.statBadge}>ATUALIZADO</Text>
               </View>
               <Text style={styles.statValue}>{concursos.length}</Text>
               <Text style={styles.statLabel}>Concursos listados</Text>
             </View>
          </View>
        )}

        <View style={styles.sectionHeader}>
           <Text style={styles.sectionTitle}>Recomendados para você</Text>
           <Pressable onPress={() => router.push('/(tabs)/busca')}><Text style={styles.viewAll}>Ver todos</Text></Pressable>
        </View>

        {loading ? (
          <LoadingState message="Buscando os melhores concursos..." />
        ) : error ? (
          <ErrorState 
            message={error} 
            onRetry={() => loadData(false)} 
            onDemo={() => loadData(true)} 
          />
        ) : concursos.length === 0 ? (
          <EmptyState message="Nenhum concurso disponível no momento." />
        ) : (
          concursos.slice(0, 5).map((item) => (
            <ConcursoCard key={item.id} item={item} />
          ))
        )}
      </ScrollView>

      {/* SIDEBAR MENU */}
      <Modal visible={isMenuOpen} transparent animationType="fade">
        <View style={styles.drawerOverlay}>
          <Pressable style={styles.drawerBackdrop} onPress={() => setIsMenuOpen(false)} />
          <View style={[styles.drawerContent, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.drawerTitle}>RadarConcursos</Text>
            
            <View style={styles.drawerLinks}>
              <Pressable style={styles.drawerLink} onPress={() => navTo('/(tabs)/inicio')}>
                <MaterialIcons name="home" size={24} color={theme.colors.primary} />
                <Text style={styles.drawerLinkText}>Início</Text>
              </Pressable>
              <Pressable style={styles.drawerLink} onPress={() => navTo('/(tabs)/busca')}>
                <MaterialIcons name="search" size={24} color={theme.colors.primary} />
                <Text style={styles.drawerLinkText}>Buscar Concursos</Text>
              </Pressable>
              <Pressable style={styles.drawerLink} onPress={() => navTo('/(tabs)/salvos')}>
                <MaterialIcons name="bookmark" size={24} color={theme.colors.primary} />
                <Text style={styles.drawerLinkText}>Favoritos</Text>
              </Pressable>
              <Pressable style={styles.drawerLink} onPress={() => navTo('/(tabs)/alertas')}>
                <MaterialIcons name="notifications-active" size={24} color={theme.colors.primary} />
                <Text style={styles.drawerLinkText}>Alertas</Text>
              </Pressable>
              <Pressable style={styles.drawerLink} onPress={() => navTo('/notificacoes')}>
                <MaterialIcons name="notifications" size={24} color={theme.colors.primary} />
                <Text style={styles.drawerLinkText}>Notificações</Text>
              </Pressable>
              <Pressable style={styles.drawerLink} onPress={() => navTo('/(tabs)/perfil')}>
                <MaterialIcons name="person" size={24} color={theme.colors.primary} />
                <Text style={styles.drawerLinkText}>Perfil</Text>
              </Pressable>

              <View style={styles.drawerDivider} />

              <Pressable style={styles.drawerLink} onPress={() => navTo('/privacidade-seguranca')}>
                <MaterialIcons name="lock" size={24} color={theme.colors.mutedText} />
                <Text style={[styles.drawerLinkText, { color: theme.colors.mutedText }]}>Privacidade e Segurança</Text>
              </Pressable>
            </View>

            <Pressable style={styles.drawerLinkLogout} onPress={handleLogout}>
              <MaterialIcons name="logout" size={24} color={theme.colors.error} />
              <Text style={styles.drawerLinkTextLogout}>Sair</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  header: { padding: 24, paddingTop: 64, backgroundColor: theme.colors.surfaceLowest, elevation: 4, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.05, shadowRadius: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  appTitle: { fontSize: 20, fontWeight: '900', color: theme.colors.primary },
  greeting: { fontSize: 28, fontWeight: '900', color: theme.colors.primary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: theme.colors.mutedText },
  demoBadge: { backgroundColor: theme.colors.amber, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-start', marginTop: 12 },
  demoText: { color: theme.colors.amberDark, fontSize: 10, fontWeight: 'bold' },
  scrollContent: { padding: 24, paddingBottom: 100 },
  statsGrid: { marginBottom: 32 },
  statBox: { padding: 20, borderRadius: 16 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  statBadge: { backgroundColor: theme.colors.onTertiaryContainer, color: theme.colors.primary, fontSize: 10, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statValue: { fontSize: 40, fontWeight: '900', color: theme.colors.surfaceLowest },
  statLabel: { fontSize: 12, fontWeight: 'bold', color: theme.colors.surfaceLowest, textTransform: 'uppercase', opacity: 0.8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: theme.colors.primary },
  viewAll: { fontSize: 12, fontWeight: 'bold', color: theme.colors.primary },
  
  drawerOverlay: { flex: 1, flexDirection: 'row' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawerContent: { width: '75%', backgroundColor: theme.colors.surfaceLowest, padding: 24, position: 'absolute', height: '100%', left: 0 },
  drawerTitle: { fontSize: 24, fontWeight: '900', color: theme.colors.primary, marginBottom: 32 },
  drawerLinks: { flex: 1 },
  drawerLink: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 },
  drawerLinkText: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text },
  drawerDivider: { height: 1, backgroundColor: theme.colors.surfaceHighest, marginVertical: 16 },
  drawerLinkLogout: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, marginTop: 'auto' },
  drawerLinkTextLogout: { fontSize: 16, fontWeight: 'bold', color: theme.colors.error }
});
