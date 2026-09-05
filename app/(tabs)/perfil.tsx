import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../src/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/providers/AuthProvider';

export default function Perfil() {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    // Use layout protection redirect or router.replace
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
      {/* Header and Hero in one block */}
      <View style={styles.header}>
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>RadarConcursos</Text>
          <Pressable onPress={() => router.push('/notificacoes')} style={{ padding: 8, marginRight: -8 }}>
            <MaterialIcons name="notifications" size={24} color={theme.colors.primary} />
          </Pressable>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
             <View style={styles.avatarPlaceholder} />
             <View style={styles.verifiedBadge}>
               <MaterialIcons name="verified" size={12} color={theme.colors.surfaceLowest} />
             </View>
          </View>
          <Text style={styles.profileName}>{user?.name || 'Carregando...'}</Text>
          <Text style={styles.profileRole}>{user?.email || ''}</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        <Text style={styles.sectionLabel}>CONFIGURAÇÕES DA CONTA</Text>
        <View style={styles.menuGroup}>
           <Pressable style={styles.menuItem} onPress={() => router.push('/preferencias-iniciais')}>
             <View style={styles.menuItemIcon}><MaterialIcons name="tune" size={24} color={theme.colors.primary} /></View>
             <View style={styles.menuItemTextContainer}>
               <Text style={styles.menuItemTitle}>Minhas Preferências</Text>
               <Text style={styles.menuItemSubtitle}>Cidades, Áreas, Bancas</Text>
             </View>
             <MaterialIcons name="chevron-right" size={24} color={theme.colors.mutedText} />
           </Pressable>
        </View>

        <Text style={styles.sectionLabel}>SEGURANÇA E SISTEMA</Text>
        <View style={styles.menuGroup}>
           <Pressable style={styles.menuItem} onPress={() => router.push('/privacidade-seguranca')}>
             <View style={styles.menuItemIcon}><MaterialIcons name="lock" size={24} color={theme.colors.primary} /></View>
             <View style={styles.menuItemTextContainer}>
               <Text style={styles.menuItemTitle}>Privacidade e Segurança</Text>
             </View>
             <MaterialIcons name="chevron-right" size={24} color={theme.colors.mutedText} />
           </Pressable>
        </View>

        <Text style={styles.sectionLabel}>APARÊNCIA</Text>
        <View style={styles.appearanceCard}>
          <View style={styles.appearanceHeading}>
            <View style={styles.menuItemTextContainer}>
              <Text style={styles.menuItemTitle}>Modo de exibição</Text>
              <Text style={styles.menuItemSubtitle}>Escolha como o app será exibido.</Text>
            </View>
            <MaterialIcons name={theme.isDark ? 'dark-mode' : 'light-mode'} size={24} color={theme.colors.primary} />
          </View>
          <View style={styles.modeOptions}>
            <Pressable
              style={[styles.modeOption, theme.mode === 'light' && styles.modeOptionActive]}
              onPress={() => void theme.setMode('light')}
              accessibilityRole="radio"
              accessibilityState={{ selected: theme.mode === 'light' }}
            >
              <MaterialIcons name="light-mode" size={18} color={theme.mode === 'light' ? theme.colors.surfaceLowest : theme.colors.primary} />
              <Text style={[styles.modeOptionText, theme.mode === 'light' && styles.modeOptionTextActive]}>Claro</Text>
            </Pressable>
            <Pressable
              style={[styles.modeOption, theme.mode === 'dark' && styles.modeOptionActive]}
              onPress={() => void theme.setMode('dark')}
              accessibilityRole="radio"
              accessibilityState={{ selected: theme.mode === 'dark' }}
            >
              <MaterialIcons name="dark-mode" size={18} color={theme.mode === 'dark' ? theme.colors.surfaceLowest : theme.colors.primary} />
              <Text style={[styles.modeOptionText, theme.mode === 'dark' && styles.modeOptionTextActive]}>Escuro</Text>
            </Pressable>
          </View>
        </View>

        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
           <View style={styles.logoutIcon}>
             <MaterialIcons name="logout" size={24} color={theme.colors.error} />
           </View>
           <Text style={styles.logoutText}>Sair</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  header: { backgroundColor: theme.colors.surfaceLowest, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 32, elevation: 4, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.05, shadowRadius: 10, marginBottom: 24 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  topBarTitle: { fontSize: 24, fontWeight: '900', color: theme.colors.primary },
  profileSection: { alignItems: 'center' },
  avatarWrapper: { width: 112, height: 112, borderRadius: 24, backgroundColor: theme.colors.surfaceHighest, marginBottom: 16, position: 'relative' },
  avatarPlaceholder: { flex: 1, backgroundColor: theme.colors.secondaryContainer, borderRadius: 24 },
  verifiedBadge: { position: 'absolute', bottom: -8, right: -8, backgroundColor: theme.colors.tertiaryContainer, padding: 6, borderRadius: 12, borderWidth: 2, borderColor: theme.colors.surfaceLowest },
  profileName: { fontSize: 28, fontWeight: 'bold', color: theme.colors.primary, marginBottom: 4 },
  profileRole: { fontSize: 16, color: theme.colors.mutedText, fontWeight: '500' },
  premiumBanner: { backgroundColor: theme.colors.primaryContainer, padding: 24, borderRadius: 24, marginBottom: 32, elevation: 4, shadowColor: theme.colors.primaryContainer, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 12 },
  premiumBadge: { alignSelf: 'flex-start', backgroundColor: theme.colors.tertiaryContainer, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 16 },
  premiumBadgeText: { color: theme.colors.onTertiaryContainer, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  premiumTitle: { fontSize: 20, fontWeight: 'bold', color: theme.colors.surfaceLowest, marginBottom: 20, lineHeight: 26 },
  premiumBtn: { alignSelf: 'flex-start', backgroundColor: theme.colors.tertiaryContainer, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  premiumBtnText: { color: theme.colors.onTertiaryContainer, fontSize: 14, fontWeight: 'bold' },
  sectionLabel: { fontSize: 10, fontWeight: 'bold', color: theme.colors.mutedText, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16, marginLeft: 8 },
  menuGroup: { marginBottom: 32 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surfaceLowest, padding: 16, borderRadius: 16, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 4 },
  menuItemIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: theme.colors.surfaceLow, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  menuItemTextContainer: { flex: 1 },
  menuItemTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text, marginBottom: 2 },
  menuItemSubtitle: { fontSize: 12, color: theme.colors.mutedText },
  appearanceCard: { backgroundColor: theme.colors.surfaceLowest, padding: 16, borderRadius: 16, marginBottom: 32, borderWidth: 1, borderColor: theme.colors.surfaceHighest },
  appearanceHeading: { flexDirection: 'row', alignItems: 'center' },
  modeOptions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  modeOption: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.surfaceHighest, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  modeOptionActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  modeOptionText: { color: theme.colors.primary, fontSize: 14, fontWeight: 'bold' },
  modeOptionTextActive: { color: theme.colors.surfaceLowest },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.errorContainer, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(186, 26, 26, 0.1)' },
  logoutIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: theme.colors.surfaceLowest, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  logoutText: { fontSize: 16, fontWeight: 'bold', color: theme.colors.error }
});
