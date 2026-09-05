import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../src/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Onboarding() {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>RadarConcursos</Text>
        </View>

        <View style={styles.content}>
        <View style={styles.cardHighlight}>
           <Text style={styles.cardBadge}>OPEN</Text>
           <Text style={styles.cardTitle}>Prefeitura de São Paulo</Text>
           <Text style={styles.cardSubtitle}>Cargo: Assistente Social</Text>
           <View style={styles.salaryRow}>
             <MaterialIcons name="payments" size={16} color={theme.colors.mutedText} />
             <Text style={styles.salaryText}>R$ 6.450,00</Text>
           </View>
        </View>

        <View style={styles.pagination}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <Text style={styles.heading}>Encontre concursos ideais para você</Text>
        <Text style={styles.description}>
          Filtre por cidade, banca e área. Receba alertas assim que surgir uma oportunidade.
        </Text>
        
        <View style={styles.features}>
            <View style={styles.featureBox}>
               <MaterialIcons name="map" size={24} color={theme.colors.primary} />
               <Text style={styles.featureText}>Local</Text>
            </View>
            <View style={styles.featureBox}>
               <MaterialIcons name="filter-list" size={24} color={theme.colors.primary} />
               <Text style={styles.featureText}>Filtros</Text>
            </View>
            <View style={styles.featureBox}>
               <MaterialIcons name="schedule" size={24} color={theme.colors.primary} />
               <Text style={styles.featureText}>Prazos</Text>
            </View>
        </View>

        <Pressable style={styles.button} onPress={() => router.push('/login')} accessibilityRole="button">
          <Text style={styles.buttonText}>Começar agora</Text>
          <MaterialIcons name="arrow-forward" size={20} color={theme.colors.onTertiaryContainer} />
        </Pressable>

        <Pressable style={styles.footer} onPress={() => router.push('/login')} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.footerText}>Já possui uma conta? </Text>
          <View>
            <Text style={styles.footerLink}>Entrar</Text>
          </View>
        </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface, paddingHorizontal: 24 },
  scrollContent: { flexGrow: 1 },
  header: { marginBottom: 40 },
  title: { fontSize: 28, fontWeight: '900', color: theme.colors.primary, letterSpacing: -0.5 },
  content: { flex: 1 },
  cardHighlight: { backgroundColor: theme.colors.surfaceLowest, padding: 20, borderRadius: 16, marginBottom: 48, elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 8 },
  cardBadge: { backgroundColor: theme.colors.secondaryContainer, color: theme.colors.onSecondaryContainer, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 10, fontWeight: 'bold', marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.primary, marginBottom: 8 },
  cardSubtitle: { fontSize: 14, color: theme.colors.mutedText, marginBottom: 16 },
  salaryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  salaryText: { fontSize: 14, fontWeight: 'bold', color: theme.colors.primary },
  pagination: { flexDirection: 'row', gap: 6, marginBottom: 24 },
  dot: { height: 6, width: 6, borderRadius: 3, backgroundColor: theme.colors.mutedText, opacity: 0.3 },
  dotActive: { width: 32, backgroundColor: theme.colors.primary, opacity: 1 },
  heading: { fontSize: 32, fontWeight: '900', color: theme.colors.primary, marginBottom: 16, lineHeight: 36, letterSpacing: -0.5 },
  description: { fontSize: 16, color: theme.colors.mutedText, marginBottom: 32, lineHeight: 24 },
  features: { flexDirection: 'row', gap: 12, marginBottom: 48 },
  featureBox: { flex: 1, backgroundColor: theme.colors.surfaceLow, padding: 16, borderRadius: 12, alignItems: 'center', gap: 8 },
  featureText: { fontSize: 10, fontWeight: 'bold', color: theme.colors.mutedText, textTransform: 'uppercase' },
  button: { backgroundColor: theme.colors.tertiaryContainer, padding: 20, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 'auto' },
  buttonText: { color: theme.colors.onTertiaryContainer, fontSize: 18, fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24, minHeight: 44 },
  footerText: { color: theme.colors.mutedText, fontSize: 14 },
  footerLink: { color: theme.colors.primary, fontSize: 14, fontWeight: 'bold' }
});
