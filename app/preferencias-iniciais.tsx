import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../src/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { getPreferences, updatePreferences } from '../src/api/preferences';
import { useAuth } from '../src/providers/AuthProvider';
import { AREAS } from '../src/constants/areas';
import { BANCAS } from '../src/constants/bancas';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Preferencias() {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [areas, setAreas] = useState<string[]>([]);
  
  const [cargoInput, setCargoInput] = useState('');
  const [cargoKeywords, setCargoKeywords] = useState<string[]>([]);
  
  const [cidade, setCidade] = useState('');
  
  const [bancas, setBancas] = useState<string[]>([]);
  
  // Modals state
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showBancaModal, setShowBancaModal] = useState(false);
  const [bancaSearch, setBancaSearch] = useState('');

  useEffect(() => {
    if (authLoading) return;
    const loadPrefs = async () => {
      try {
        const prefs = await getPreferences();
        if (prefs) {
          if (prefs.areas) setAreas(prefs.areas);
          if (prefs.cargo_keywords) setCargoKeywords(prefs.cargo_keywords);
          if (prefs.cidades) setCidade(prefs.cidades.join(', '));
          if (prefs.bancas) setBancas(prefs.bancas);
        }
      } catch (e: any) {
        console.warn('Could not load preferences', e);
      } finally {
        setLoading(false);
      }
    };
    loadPrefs();
  }, [authLoading]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const cidades = cidade.split(',').map(s => s.trim()).filter(Boolean);
      
      await updatePreferences({
        areas: areas,
        ufs: ["MG"], // Optional: implement UF selection
        cidades: cidades,
        bancas: bancas,
        cargo_keywords: cargoKeywords,
        only_open: false,
        notification_channels: ["app"]
      });
      router.replace('/(tabs)/inicio');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const addCargo = () => {
    const trimmed = cargoInput.trim();
    if (trimmed && !cargoKeywords.includes(trimmed)) {
      setCargoKeywords([...cargoKeywords, trimmed]);
    }
    setCargoInput('');
  };

  const removeCargo = (keyword: string) => {
    setCargoKeywords(cargoKeywords.filter(k => k !== keyword));
  };

  const toggleArea = (val: string) => {
    if (areas.includes(val)) {
      setAreas(areas.filter(a => a !== val));
    } else {
      setAreas([...areas, val]);
    }
  };

  const toggleBanca = (val: string) => {
    if (bancas.includes(val)) {
      setBancas(bancas.filter(b => b !== val));
    } else {
      setBancas([...bancas, val]);
    }
  };

  if (loading || authLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const filteredBancas = BANCAS.filter(b => b.toLowerCase().includes(bancaSearch.toLowerCase()));

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        keyboardShouldPersistTaps="handled" 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.iconRow}>
             <View style={styles.headerIcon}>
               <MaterialIcons name="tune" size={24} color={theme.colors.primary} />
             </View>
          </View>
          <Text style={styles.heading}>Personalize seu Radar</Text>
          <Text style={styles.description}>
            Configure seus filtros para receber apenas os editais que realmente importam.
          </Text>
        </View>

        {error ? <Text style={{ color: theme.colors.error, marginBottom: 16 }}>{error}</Text> : null}

        {/* AREA DE INTERESSE */}
        <View style={styles.formGroup}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>ÁREA DE INTERESSE</Text>
            <Text style={styles.countText}>{areas.length} selecionadas</Text>
          </View>
          <Pressable style={styles.selectBtn} onPress={() => setShowAreaModal(true)}>
            <MaterialIcons name="category" size={20} color={theme.colors.mutedText} />
            <Text style={styles.selectBtnText}>
              {areas.length > 0 ? 'Alterar áreas' : 'Selecionar áreas'}
            </Text>
            <MaterialIcons name="chevron-right" size={24} color={theme.colors.mutedText} style={{ marginLeft: 'auto' }} />
          </Pressable>
          <View style={styles.chipRow}>
            {areas.map(a => {
              const label = AREAS.find(x => x.value === a)?.label || a;
              return (
                <View key={a} style={styles.chipSelected}>
                  <Text style={styles.chipTextSelected}>{label}</Text>
                  <Pressable onPress={() => toggleArea(a)}>
                    <MaterialIcons name="close" size={16} color={theme.colors.surfaceLowest} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>

        {/* CARGO DE INTERESSE */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>CARGO DE INTERESSE</Text>
          <View style={styles.inputContainer}>
             <MaterialIcons name="badge" size={20} color={theme.colors.mutedText} style={styles.inputIcon} />
             <TextInput 
               style={styles.input} 
               value={cargoInput} 
               onChangeText={setCargoInput} 
               placeholder="Ex: Assistente Social" 
               onSubmitEditing={addCargo}
             />
             <Pressable onPress={addCargo} style={{ padding: 8 }}>
               <MaterialIcons name="add-circle" size={24} color={theme.colors.primary} />
             </Pressable>
          </View>
          <View style={styles.chipRow}>
            {cargoKeywords.map(k => (
              <View key={k} style={styles.chipSelected}>
                <Text style={styles.chipTextSelected}>{k}</Text>
                <Pressable onPress={() => removeCargo(k)}>
                  <MaterialIcons name="close" size={16} color={theme.colors.surfaceLowest} />
                </Pressable>
              </View>
            ))}
          </View>
        </View>

        {/* CIDADE DE INTERESSE */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>CIDADE DE INTERESSE (separado por vírgula)</Text>
          <View style={styles.inputContainer}>
             <MaterialIcons name="location-on" size={20} color={theme.colors.mutedText} style={styles.inputIcon} />
             <TextInput 
               style={styles.input} 
               value={cidade} 
               onChangeText={setCidade} 
               placeholder="Ex: Belo Horizonte, Contagem" 
             />
          </View>
        </View>

        {/* BANCAS FAVORITAS */}
        <View style={styles.formGroup}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>BANCAS FAVORITAS</Text>
            <Text style={styles.countText}>{bancas.length} selecionadas</Text>
          </View>
          <Pressable style={styles.selectBtn} onPress={() => setShowBancaModal(true)}>
            <MaterialIcons name="account-balance" size={20} color={theme.colors.mutedText} />
            <Text style={styles.selectBtnText}>
              {bancas.length > 0 ? 'Alterar bancas' : 'Selecionar bancas'}
            </Text>
            <MaterialIcons name="chevron-right" size={24} color={theme.colors.mutedText} style={{ marginLeft: 'auto' }} />
          </Pressable>
          <View style={styles.chipRow}>
             {bancas.map(b => (
               <View key={b} style={styles.chipSelected}>
                 <Text style={styles.chipTextSelected}>{b}</Text>
                 <Pressable onPress={() => toggleBanca(b)}>
                   <MaterialIcons name="close" size={16} color={theme.colors.surfaceLowest} />
                 </Pressable>
               </View>
             ))}
          </View>
        </View>

        <Pressable style={styles.footerBtn} onPress={handleSave} disabled={saving}>
           {saving ? (
              <ActivityIndicator color={theme.colors.onTertiaryContainer} />
           ) : (
              <>
                <Text style={styles.footerBtnText}>Pronto, ver concursos</Text>
                <MaterialIcons name="arrow-forward" size={20} color={theme.colors.onTertiaryContainer} />
              </>
           )}
        </Pressable>
      </ScrollView>

      {/* ÁREA Modal */}
      <Modal visible={showAreaModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { paddingTop: insets.top || 24, paddingBottom: insets.bottom || 24 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Áreas de interesse</Text>
            <Pressable onPress={() => setShowAreaModal(false)}>
              <MaterialIcons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          </View>
          <FlatList
            data={AREAS}
            keyExtractor={item => item.value}
            renderItem={({ item }) => (
              <Pressable style={styles.modalListItem} onPress={() => toggleArea(item.value)}>
                <Text style={styles.modalListText}>{item.label}</Text>
                {areas.includes(item.value) && <MaterialIcons name="check" size={24} color={theme.colors.primary} />}
              </Pressable>
            )}
          />
        </View>
      </Modal>

      {/* BANCAS Modal */}
      <Modal visible={showBancaModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { paddingTop: insets.top || 24, paddingBottom: insets.bottom || 24 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Bancas favoritas</Text>
            <Pressable onPress={() => setShowBancaModal(false)}>
              <MaterialIcons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          </View>
          <View style={[styles.inputContainer, { marginHorizontal: 24, marginBottom: 16 }]}>
            <MaterialIcons name="search" size={20} color={theme.colors.mutedText} />
            <TextInput 
              style={styles.input} 
              placeholder="Buscar banca..." 
              value={bancaSearch}
              onChangeText={setBancaSearch}
            />
          </View>
          <FlatList
            data={filteredBancas}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <Pressable style={styles.modalListItem} onPress={() => toggleBanca(item)}>
                <Text style={styles.modalListText}>{item}</Text>
                {bancas.includes(item) && <MaterialIcons name="check" size={24} color={theme.colors.primary} />}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  scrollContent: { padding: 24, paddingTop: 64 },
  header: { marginBottom: 32 },
  iconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  headerIcon: { backgroundColor: theme.colors.primaryContainer, width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 28, fontWeight: '900', color: theme.colors.primary, marginBottom: 12 },
  description: { fontSize: 16, color: theme.colors.mutedText, lineHeight: 24 },
  formGroup: { marginBottom: 24 },
  label: { fontSize: 10, fontWeight: 'bold', color: theme.colors.mutedText, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  countText: { fontSize: 10, color: theme.colors.primary, fontWeight: 'bold' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surfaceHighest, borderRadius: 12, paddingHorizontal: 16, height: 56 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: theme.colors.text, fontWeight: '600' },
  selectBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surfaceHighest, borderRadius: 12, paddingHorizontal: 16, height: 56, marginBottom: 12 },
  selectBtnText: { fontSize: 16, color: theme.colors.text, fontWeight: '600', marginLeft: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chipSelected: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, gap: 8 },
  chipTextSelected: { color: theme.colors.surfaceLowest, fontSize: 14, fontWeight: 'bold' },
  footerBtn: { backgroundColor: theme.colors.tertiaryContainer, padding: 20, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 32 },
  footerBtnText: { color: theme.colors.onTertiaryContainer, fontSize: 18, fontWeight: 'bold' },
  
  modalContainer: { flex: 1, backgroundColor: theme.colors.surface },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: theme.colors.primary },
  modalListItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: theme.colors.surfaceHighest },
  modalListText: { fontSize: 16, color: theme.colors.text },
});
