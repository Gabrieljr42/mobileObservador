import { View, TextInput, StyleSheet } from 'react-native';
import { useAppTheme } from '../theme';
import { MaterialIcons } from '@expo/vector-icons';

export function SearchInput({ value, onChangeText, placeholder = 'Buscar...' }: { value: string, onChangeText: (t: string) => void, placeholder?: string }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.container}>
      <MaterialIcons name="search" size={24} color={theme.colors.mutedText} />
      <TextInput 
        style={styles.input} 
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={theme.colors.mutedText}
      />
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: theme.colors.surfaceHighest, 
    borderRadius: 12, 
    paddingHorizontal: 16, 
    height: 56, 
  },
  input: { 
    flex: 1, 
    marginLeft: 12, 
    fontSize: 16, 
    color: theme.colors.text,
  }
});
