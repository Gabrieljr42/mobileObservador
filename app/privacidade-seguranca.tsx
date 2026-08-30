import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../src/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/providers/AuthProvider';
import { clearLocalData } from '../src/db/database';
import { forgetOfflineAccount } from '../src/storage/auth';

export default function PrivacidadeSeguranca() {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    Alert.alert('Sair da conta', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: async () => {
        await logout();
      }}
    ]);
  };

  const handleClearData = () => {
    Alert.alert('Limpar Sessão Local', 'Isso removerá seus dados locais e fará logout da conta atual. Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpar', style: 'destructive', onPress: async () => {
        await clearLocalData();
        await forgetOfflineAccount();
        await logout();
      }}
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.primary} />
        </Pressable>
        <Text style={styles.title}>Privacidade e Segurança</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONTA</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>Email logado: <Text style={{ fontWeight: 'bold' }}>{user?.email || 'Nenhum'}</Text></Text>
            <Pressable style={styles.dangerBtn} onPress={handleLogout}>
              <MaterialIcons name="logout" size={20} color={theme.colors.error} />
              <Text style={styles.dangerBtnText}>Sair da conta</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DADOS SALVOS</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>
              Suas preferências, favoritos e alertas são salvos em nossos servidores para personalizar suas recomendações de editais.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SEGURANÇA</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>
              O acesso à sua conta utiliza um token de autenticação seguro. Suas senhas não são armazenadas em texto plano.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRIVACIDADE</Text>
          <View style={styles.card}>
            <Text style={styles.cardText}>
              Os dados coletados neste aplicativo são utilizados exclusivamente para as funcionalidades internas de notificação e personalização de conteúdo.
            </Text>
          </View>
        </View>

        <Pressable style={styles.actionBtn} onPress={handleClearData}>
          <MaterialIcons name="delete-forever" size={20} color={theme.colors.error} />
          <Text style={styles.dangerBtnText}>Excluir sessão local</Text>
        </Pressable>

        <Pressable style={[styles.actionBtn, { opacity: 0.5 }]} disabled>
          <MaterialIcons name="delete" size={20} color={theme.colors.mutedText} />
          <Text style={[styles.dangerBtnText, { color: theme.colors.mutedText }]}>Excluir conta (em breve)</Text>
        </Pressable>

      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  header: { padding: 24, paddingBottom: 16, backgroundColor: theme.colors.surfaceLowest, elevation: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 },
  title: { fontSize: 20, fontWeight: '900', color: theme.colors.primary },
  backBtn: { padding: 8, marginLeft: -8 },
  content: { padding: 24, gap: 32 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: theme.colors.mutedText, letterSpacing: 1 },
  card: { backgroundColor: theme.colors.surfaceLowest, padding: 16, borderRadius: 12, gap: 16, borderWidth: 1, borderColor: theme.colors.surfaceHighest },
  cardText: { fontSize: 14, color: theme.colors.text, lineHeight: 22 },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dangerBtnText: { color: theme.colors.error, fontWeight: 'bold', fontSize: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderWidth: 1, borderColor: theme.colors.surfaceHighest, borderRadius: 12, backgroundColor: theme.colors.surfaceLowest }
});
