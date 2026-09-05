import { Tabs } from 'expo-router';
import { useAppTheme } from '../../src/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const theme = useAppTheme();

  const insets = useSafeAreaInsets();
  const iconStyles = StyleSheet.create({
    tabIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  });

  const tabIcon = (name: any, color: string) => (
    <View style={iconStyles.tabIcon}>
      <MaterialIcons name={name} size={24} color={color} />
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          height: 72 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 4,
        },
        tabBarActiveTintColor: theme.colors.onTertiaryContainer,
        tabBarInactiveTintColor: theme.colors.mutedText,
        tabBarLabelStyle: { fontSize: 10, lineHeight: 12, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 2 },
        tabBarItemStyle: { flex: 1, justifyContent: 'center', paddingVertical: 0 },
        tabBarIconStyle: { height: 28, marginBottom: 0 },
      }}
    >
      <Tabs.Screen
        name="inicio"
        options={{
          tabBarLabel: 'Início',
          tabBarIcon: ({ color }) => tabIcon('home', color),
        }}
      />
      <Tabs.Screen
        name="busca"
        options={{
          tabBarLabel: 'Buscar',
          tabBarIcon: ({ color }) => tabIcon('search', color),
        }}
      />
      <Tabs.Screen
        name="alertas"
        options={{
          tabBarLabel: 'Alertas',
          tabBarIcon: ({ color }) => tabIcon('notifications-active', color),
        }}
      />
      <Tabs.Screen
        name="salvos"
        options={{
          tabBarLabel: 'Salvos',
          tabBarIcon: ({ color }) => tabIcon('bookmark', color),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color }) => tabIcon('person', color),
        }}
      />
      <Tabs.Screen
        name="atualizacoes"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
