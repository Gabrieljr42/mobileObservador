import { View, Text, StyleSheet, ScrollView, Pressable, FlatList, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useAppTheme } from '../../src/theme';
import { EmptyState } from '../../src/components/EmptyState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { getAlerts, createAlert, updateAlert, deleteAlert } from '../../src/api/alerts';
import { MaterialIcons } from '@expo/vector-icons';
import { LoadingState } from '../../src/components/LoadingState';
import { ErrorState } from '../../src/components/ErrorState';

export default function Alertas() {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const insets = useSafeAreaInsets();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states for creating a new alert
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAlerts();
      setAlerts(data);
    } catch (e: any) {
      setError('Erro ao carregar alertas.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadAlerts();
    }, [])
  );

  const toggleAlert = async (alert: any) => {
    try {
      await updateAlert(alert.id, { active: !alert.active });
      setAlerts(alerts.map(a => a.id === alert.id ? { ...a, active: !a.active } : a));
    } catch (e: any) {
      Alert.alert('Erro', 'Não foi possível alterar o alerta.');
    }
  };

  const removeAlert = async (id: number) => {
    try {
      await deleteAlert(id);
      setAlerts(alerts.filter(a => a.id !== id));
    } catch (e: any) {
      Alert.alert('Erro', 'Não foi possível excluir o alerta.');
    }
  };

  const handleCreate = async () => {
    if (!newName || !newKeyword) {
      Alert.alert('Erro', 'Preencha o nome e o cargo/palavra-chave.');
      return;
    }
    setSaving(true);
    try {
      const newAlert = await createAlert({
        name: newName,
        cargo_keyword: newKeyword,
        active: true
      });
      setAlerts([...alerts, newAlert]);
      setIsCreating(false);
      setNewName('');
      setNewKeyword('');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível criar o alerta.');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.alertCard}>
      <View style={styles.alertHeader}>
        <Text style={styles.alertName}>{item.name}</Text>
        <Pressable onPress={() => toggleAlert(item)}>
          <MaterialIcons name={item.active ? "toggle-on" : "toggle-off"} size={32} color={item.active ? theme.colors.primary : theme.colors.mutedText} />
        </Pressable>
      </View>
      <View style={styles.alertMeta}>
        {item.cargo_keyword ? <Text style={styles.metaLabel}>Cargo: <Text style={styles.metaValue}>{item.cargo_keyword}</Text></Text> : null}
        {item.banca ? <Text style={styles.metaLabel}>Banca: <Text style={styles.metaValue}>{item.banca}</Text></Text> : null}
      </View>
      <Pressable style={styles.deleteBtn} onPress={() => removeAlert(item.id)}>
        <MaterialIcons name="delete" size={20} color={theme.colors.error} />
        <Text style={styles.deleteBtnText}>Excluir</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meus Alertas</Text>
        <Text style={styles.subtitle}>Gerencie os alertas para as vagas de seu interesse.</Text>
      </View>
      
      {loading ? (
        <LoadingState message="Carregando alertas..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadAlerts} />
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(i) => i.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={[styles.content, { paddingBottom: 100 + insets.bottom }]}
          ListEmptyComponent={<EmptyState title="Você não tem alertas" message="Crie um alerta para ser notificado sobre novas vagas." />}
          ListHeaderComponent={
            <View style={{ marginBottom: 24 }}>
              {isCreating ? (
                <View style={styles.createCard}>
                  <Text style={styles.createTitle}>Novo Alerta</Text>
                  <TextInput style={styles.input} placeholder="Nome do alerta" value={newName} onChangeText={setNewName} />
                  <TextInput style={styles.input} placeholder="Palavra-chave (ex: Assistente Social)" value={newKeyword} onChangeText={setNewKeyword} />
                  <View style={styles.createActions}>
                    <Pressable style={[styles.createBtn, { backgroundColor: theme.colors.surfaceHighest }]} onPress={() => setIsCreating(false)}><Text>Cancelar</Text></Pressable>
                    <Pressable style={styles.createBtn} onPress={handleCreate} disabled={saving}>
                      {saving ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.createBtnText}>Salvar</Text>}
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable style={styles.addBtn} onPress={() => setIsCreating(true)}>
                  <MaterialIcons name="add" size={24} color={theme.colors.onTertiaryContainer} />
                  <Text style={styles.addBtnText}>Novo Alerta</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  header: { padding: 24, paddingTop: 64, backgroundColor: theme.colors.surfaceLowest, elevation: 4, zIndex: 10 },
  title: { fontSize: 32, fontWeight: '900', color: theme.colors.primary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: theme.colors.mutedText, fontWeight: '500' },
  content: { padding: 24 },
  alertCard: { backgroundColor: theme.colors.surfaceLowest, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.surfaceHighest },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  alertName: { fontSize: 18, fontWeight: 'bold', color: theme.colors.primary },
  alertMeta: { marginBottom: 16 },
  metaLabel: { fontSize: 14, color: theme.colors.mutedText },
  metaValue: { fontWeight: 'bold', color: theme.colors.text },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deleteBtnText: { color: theme.colors.error, fontSize: 14, fontWeight: 'bold' },
  addBtn: { backgroundColor: theme.colors.tertiaryContainer, padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addBtnText: { color: theme.colors.onTertiaryContainer, fontSize: 16, fontWeight: 'bold' },
  createCard: { backgroundColor: theme.colors.surfaceHighest, padding: 16, borderRadius: 12 },
  createTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  input: { backgroundColor: theme.colors.surfaceLowest, padding: 12, borderRadius: 8, marginBottom: 12 },
  createActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  createBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  createBtnText: { color: 'white', fontWeight: 'bold' }
});
