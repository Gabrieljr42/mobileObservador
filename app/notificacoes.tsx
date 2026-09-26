import { useSyncRevision } from '../src/sync/revision';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useAppTheme } from '../src/theme';
import { EmptyState } from '../src/components/EmptyState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { getNotifications, markAllNotificationsAsRead, markNotificationAsRead } from '../src/api/notifications';
import { syncNow } from '../src/sync/syncService';
import { MaterialIcons } from '@expo/vector-icons';
import { LoadingState } from '../src/components/LoadingState';
import { ErrorState } from '../src/components/ErrorState';
import { useRouter } from 'expo-router';
import { formatDate, formatDatesInText } from '../src/utils/formatters';
import { useAuth } from '../src/providers/AuthProvider';

export default function Notificacoes() {
  const syncRevision = useSyncRevision();
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { enablePushNotifications } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);

  const loadNotifs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (e: any) {
      setError('Erro ao carregar notificações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifs();
  }, [syncRevision]);

  const markAsRead = async (id: number) => {
    try {
      await markNotificationAsRead(id);
      setNotifications(current => current.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      console.warn(e);
    }
  };

  const markAll = async () => {
    if (markingAll || syncing) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsAsRead();
      setNotifications(current => current.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível marcar as notificações como lidas.');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleTestSync = async () => {
    if (syncing || markingAll) return;
    setSyncing(true);
    try {
      const result = await syncNow();
      if (!result.ok) {
        Alert.alert('Sincronização não concluída', result.reason || 'Verifique sua conexão e tente novamente.');
        return;
      }
      router.replace('/(tabs)/inicio');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível sincronizar os dados agora.');
    } finally {
      setSyncing(false);
    }
  };

  const handleEnablePush = async () => {
    if (enablingPush) return;
    setEnablingPush(true);
    try {
      const result = await enablePushNotifications();
      if (result.status === 'registered') {
        Alert.alert('Notificações ativadas', 'Você receberá alertas neste aparelho quando houver novidades.');
      } else if (result.status === 'permission_denied') {
        Alert.alert('Permissão não concedida', 'Ative as notificações nas configurações do aparelho para receber alertas.');
      } else if (result.status === 'unsupported') {
        Alert.alert('Indisponível neste ambiente', 'Push nativo funciona somente no aplicativo Android ou iOS.');
      } else if (result.status === 'expo_go') {
        Alert.alert('Development build necessário', 'Push nativo não é suportado no Expo Go. Instale um development build para ativar esta função.');
      } else if (result.status === 'missing_project_id') {
        Alert.alert('Configuração pendente', 'Este ambiente ainda não configurou o projeto Expo para push.');
      } else if (result.status === 'pending_revocation') {
        Alert.alert('Revogação pendente', 'A sessão anterior ainda precisa revogar um dispositivo. Tente novamente quando estiver conectado.');
      } else {
        Alert.alert('Não foi possível ativar', 'Tente novamente quando o aplicativo estiver conectado.');
      }
    } finally {
      setEnablingPush(false);
    }
  };

  const handlePressNotif = async (item: any) => {
    if (!item.is_read) {
      await markAsRead(item.id);
    }
    if (item.concurso_id) {
      router.push(`/concurso/${item.concurso_id}`);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const dateStr = item.created_at ? formatDate(item.created_at) : '';

    return (
      <Pressable style={[styles.card, !item.is_read && styles.cardUnread]} onPress={() => handlePressNotif(item)}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, !item.is_read && styles.textUnread]} numberOfLines={2}>{item.title}</Text>
          <View style={styles.rightInfo}>
            {dateStr ? <Text style={[styles.dateText, !item.is_read && styles.textUnreadDate]}>{dateStr}</Text> : null}
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
        </View>
        {item.notification_type && (
          <Text style={styles.typeText}>{item.notification_type.replace('_', ' ').toUpperCase()}</Text>
        )}
        <Text style={styles.cardBody} numberOfLines={3}>{formatDatesInText(item.body)}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={theme.colors.primary} />
          </Pressable>
          <Text style={styles.title}>Notificações</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.headerActions}>
           <Pressable style={[styles.actionBtn, markingAll && styles.actionBtnDisabled]} onPress={markAll} disabled={markingAll || syncing} accessibilityRole="button">
             {markingAll ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <MaterialIcons name="done-all" size={20} color={theme.colors.primary} />}
             <Text style={styles.actionBtnText}>Lidas</Text>
           </Pressable>
           <Pressable style={[styles.actionBtn, syncing && styles.actionBtnDisabled]} onPress={handleTestSync} disabled={syncing || markingAll} accessibilityRole="button">
             {syncing ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <MaterialIcons name="sync" size={20} color={theme.colors.primary} />}
             <Text style={styles.actionBtnText}>Sincronizar tudo</Text>
           </Pressable>
           <Pressable style={[styles.actionBtn, enablingPush && styles.actionBtnDisabled]} onPress={handleEnablePush} disabled={enablingPush || syncing || markingAll} accessibilityRole="button">
             {enablingPush ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <MaterialIcons name="notifications-active" size={20} color={theme.colors.primary} />}
             <Text style={styles.actionBtnText}>Ativar push</Text>
           </Pressable>
        </View>
      </View>
      
      {loading ? (
        <LoadingState message="Carregando notificações..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadNotifs} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(i) => i.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={[styles.content, { paddingBottom: 100 + insets.bottom }]}
          ListEmptyComponent={<EmptyState title="Você não tem notificações" message="Nenhum alerta recente para os seus concursos acompanhados." />}
        />
      )}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  header: { padding: 24, paddingTop: 64, backgroundColor: theme.colors.surfaceLowest, elevation: 4 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn: { padding: 8, marginLeft: -8 },
  title: { fontSize: 24, fontWeight: '900', color: theme.colors.primary },
  headerActions: { flexDirection: 'row', justifyContent: 'flex-start', gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: theme.colors.surfaceHighest, paddingHorizontal: 12, paddingVertical: 8, minHeight: 40, borderRadius: 8 },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { color: theme.colors.primary, fontWeight: 'bold' },
  content: { padding: 24 },
  card: { backgroundColor: theme.colors.surfaceLowest, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.surfaceHighest },
  cardUnread: { backgroundColor: theme.colors.unreadContainer, borderColor: theme.colors.secondaryContainer },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text, flex: 1 },
  textUnread: { color: theme.colors.onUnreadContainer },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.onUnreadContainer },
  cardBody: { fontSize: 14, color: theme.colors.mutedText, lineHeight: 20 },
  rightInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { fontSize: 11, color: theme.colors.mutedText, fontWeight: 'bold' },
  textUnreadDate: { color: theme.colors.onUnreadContainer },
  typeText: { fontSize: 10, color: theme.colors.primary, fontWeight: 'bold', marginBottom: 4, letterSpacing: 0.5 },
});
