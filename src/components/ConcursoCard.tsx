import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Concurso } from '../types/concurso';
import { useAppTheme } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';
import { StatusBadge } from './StatusBadge';
import { registrationSituation } from '../utils/registrationStatus';
import { vagasImediatasCargo } from '../utils/cargos';

export function ConcursoCard({ item, inSaved = false, onRemoveFavorite }: { item: Concurso, inSaved?: boolean, onRemoveFavorite?: (id: number) => void }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const router = useRouter();
  const cargoCounts = item.cargos?.map(vagasImediatasCargo) ?? [];
  const hasUnknownCargoCount = cargoCounts.some(value => value == null);
  const totalImmediateVacancies = cargoCounts.reduce<number>((total, value) => total + (value ?? 0), 0);

  return (
    <Pressable style={styles.card} onPress={() => router.push(`/concurso/${item.id}`)}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
           <View style={styles.badgeRow}>
             <StatusBadge status={item.status} situation={registrationSituation(item)} />
             {inSaved && <Text style={styles.orgLabel}>{item.orgao}</Text>}
           </View>
           <Text style={styles.cardTitle}>{item.titulo}</Text>
           {inSaved ? (
             <Text style={styles.cardOrgao}><MaterialIcons name="location-city" size={12}/> {item.orgao}</Text>
           ) : (
             <Text style={styles.cardOrg}>{item.orgao}</Text>
           )}
        </View>
        
        {inSaved && (
          <Pressable
            style={styles.favBtn}
            onPress={() => onRemoveFavorite?.(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`Remover ${item.titulo} dos salvos`}
          >
             <MaterialIcons name="favorite" size={24} color={theme.colors.onTertiaryContainer} />
          </Pressable>
        )}
      </View>
      
      {!inSaved ? (
        <View style={styles.cardMeta}>
           <View style={styles.metaItem}>
             <Text style={styles.metaLabel}>Banca</Text>
             <Text style={styles.metaValue}>{item.banca || 'N/A'}</Text>
           </View>
           <View style={styles.metaItem}>
             <Text style={styles.metaLabel}>Vagas nos cargos cadastrados</Text>
             <Text style={styles.metaValue}>{item.cargos?.length
               ? hasUnknownCargoCount
                 ? 'Quantidade de vagas imediatas: ainda não confirmada'
                 : `${totalImmediateVacancies}${item.cargos.some(cargo => cargo.cadastro_reserva) ? ' + CR' : ''}`
               : 'Pendente de conferência'}</Text>
           </View>
           <View style={styles.metaItem}>
             <Text style={styles.metaLabel}>Local</Text>
             <Text style={styles.metaValue}>{item.uf || 'N/I'}</Text>
           </View>
        </View>
      ) : (
        <View style={styles.cardFooter}>
           <View>
             <Text style={styles.footerLabel}>Banca</Text>
             <Text style={styles.footerValue}>{item.banca || 'N/A'}</Text>
           </View>
           <Pressable style={styles.detailsBtn} onPress={() => router.push(`/concurso/${item.id}`)}>
              <Text style={styles.detailsBtnText}>Ver Detalhes</Text>
           </Pressable>
        </View>
      )}
    </Pressable>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  card: { backgroundColor: theme.colors.surfaceLowest, padding: 20, borderRadius: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  headerLeft: { flex: 1 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  orgLabel: { fontSize: 10, fontWeight: 'bold', color: theme.colors.mutedText, textTransform: 'uppercase', letterSpacing: 1 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.primary, marginBottom: 4 },
  cardOrg: { fontSize: 14, color: theme.colors.mutedText, marginBottom: 16 },
  cardOrgao: { fontSize: 14, color: theme.colors.mutedText, fontWeight: '500' },
  cardMeta: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  metaItem: { minWidth: '25%' },
  metaLabel: { fontSize: 10, fontWeight: 'bold', color: theme.colors.mutedText, textTransform: 'uppercase', marginBottom: 4 },
  metaValue: { fontSize: 14, fontWeight: 'bold', color: theme.colors.primary },
  favBtn: { backgroundColor: 'rgba(255, 151, 15, 0.1)', padding: 8, borderRadius: 20 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.surfaceHighest, marginTop: 12 },
  footerLabel: { fontSize: 10, fontWeight: 'bold', color: theme.colors.mutedText, textTransform: 'uppercase', letterSpacing: 1 },
  footerValue: { fontSize: 16, fontWeight: 'bold', color: theme.colors.primary },
  detailsBtn: { backgroundColor: theme.colors.tertiaryContainer, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  detailsBtnText: { color: theme.colors.onTertiaryContainer, fontSize: 14, fontWeight: 'bold' }
});
