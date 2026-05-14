import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../src/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { useAuth } from '../src/providers/AuthProvider';

export default function Login() {
  const theme = useAppTheme();
  const styles = createStyles(theme);

  const router = useRouter();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Preencha email e senha.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        keyboardShouldPersistTaps="handled" 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>RadarConcursos</Text>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <MaterialIcons name="close" size={24} color={theme.colors.mutedText} />
          </Pressable>
        </View>
        
        <View style={styles.content}>
          <Text style={styles.heading}>Bem-vindo de volta!</Text>
          <Text style={styles.description}>Faça login para continuar.</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="E-mail"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Senha"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon} hitSlop={10}>
              <MaterialIcons name={showPassword ? "visibility" : "visibility-off"} size={24} color={theme.colors.mutedText} />
            </Pressable>
          </View>

          <Pressable style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={theme.colors.surfaceLowest} />
            ) : (
              <>
                <MaterialIcons name="login" size={20} color={theme.colors.surfaceLowest} />
                <Text style={styles.primaryButtonText}>Entrar</Text>
              </>
            )}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Não tem uma conta? </Text>
            <Pressable onPress={() => router.push('/cadastro')}>
              <Text style={styles.footerLink}>Crie agora</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  scrollContent: { flexGrow: 1, padding: 24, paddingBottom: 32, paddingTop: 64 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 },
  title: { fontSize: 24, fontWeight: '900', color: theme.colors.primary },
  closeBtn: { padding: 8 },
  content: { flex: 1, justifyContent: 'center' },
  heading: { fontSize: 28, fontWeight: '900', color: theme.colors.primary, marginBottom: 8, lineHeight: 32 },
  description: { fontSize: 16, color: theme.colors.mutedText, marginBottom: 32, lineHeight: 24 },
  errorText: { color: theme.colors.error, marginBottom: 16, fontWeight: 'bold' },
  input: { backgroundColor: theme.colors.surfaceLowest, borderWidth: 1, borderColor: theme.colors.surfaceHighest, borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16, color: theme.colors.primary },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surfaceLowest, borderWidth: 1, borderColor: theme.colors.surfaceHighest, borderRadius: 12, marginBottom: 16 },
  passwordInput: { flex: 1, padding: 16, fontSize: 16, color: theme.colors.primary },
  eyeIcon: { padding: 16 },
  primaryButton: { backgroundColor: theme.colors.primary, padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8 },
  primaryButtonText: { color: theme.colors.surfaceLowest, fontSize: 16, fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 48 },
  footerText: { color: theme.colors.mutedText, fontSize: 14 },
  footerLink: { color: theme.colors.primary, fontSize: 14, fontWeight: 'bold' }
});
