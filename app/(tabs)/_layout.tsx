import { Tabs } from 'expo-router';
import { useAppTheme } from '../../src/theme';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const theme = useAppTheme();

  const insets = useSafeAreaInsets();

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
          height: 64 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.colors.onTertiaryContainer,
        tabBarInactiveTintColor: theme.colors.mutedText,
        tabBarLabelStyle: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
        tabBarItemStyle: { paddingVertical: 6 },
      }}
    >
      <Tabs.Screen
        name="inicio"
        options={{
          tabBarLabel: 'Início',
          tabBarIcon: ({ color }) => <MaterialIcons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="busca"
        options={{
          tabBarLabel: 'Buscar',
          tabBarIcon: ({ color }) => <MaterialIcons name="search" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="alertas"
        options={{
          tabBarLabel: 'Alertas',
          tabBarIcon: ({ color }) => <MaterialIcons name="notifications-active" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="salvos"
        options={{
          tabBarLabel: 'Salvos',
          tabBarIcon: ({ color }) => <MaterialIcons name="bookmark" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color }) => <MaterialIcons name="person" size={24} color={color} />,
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
