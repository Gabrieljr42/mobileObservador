import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
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

export default function Notificacoes() {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  const markAsRead = async (id: number) => {
    try {
      await markNotificationAsRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      console.warn(e);
    }
  };

  const markAll = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.warn(e);
    }
  };

  const handleTestSync = async () => {
    try {
      await syncNow();
      await loadNotifs();
    } catch (e) {
      console.warn('Erro sync', e);
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
    const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : '';

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
        <Text style={styles.cardBody} numberOfLines={3}>{item.body}</Text>
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
           <Pressable style={styles.actionBtn} onPress={markAll}>
             <MaterialIcons name="done-all" size={20} color={theme.colors.primary} />
             <Text style={styles.actionBtnText}>Lidas</Text>
           </Pressable>
           <Pressable style={styles.actionBtn} onPress={handleTestSync}>
             <MaterialIcons name="sync" size={20} color={theme.colors.primary} />
             <Text style={styles.actionBtnText}>Sincronizar</Text>
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
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.surfaceHighest, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  actionBtnText: { color: theme.colors.primary, fontWeight: 'bold' },
  content: { padding: 24 },
  card: { backgroundColor: theme.colors.surfaceLowest, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.surfaceHighest },
  cardUnread: { backgroundColor: theme.colors.primaryContainer, borderColor: theme.colors.primaryContainer },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text, flex: 1 },
  textUnread: { color: theme.colors.primary },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary },
  cardBody: { fontSize: 14, color: theme.colors.mutedText, lineHeight: 20 },
  rightInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { fontSize: 10, color: theme.colors.mutedText, fontWeight: 'bold' },
  textUnreadDate: { color: theme.colors.primary },
  typeText: { fontSize: 10, color: theme.colors.primary, fontWeight: 'bold', marginBottom: 4, letterSpacing: 0.5 },
});
