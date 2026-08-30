import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';
import { ConcursoPublication } from '../api/publications';

export function getPublicationTypeConfig(type: string) {
  switch (type) {
    case 'edital': return { label: 'Edital', icon: 'description' };
    case 'errata': return { label: 'Errata', icon: 'error-outline' };
    case 'resultado': return { label: 'Resultado', icon: 'list' };
    case 'gabarito': return { label: 'Gabarito', icon: 'check-box' };
    case 'homologacao': return { label: 'Homologação', icon: 'emoji-events' };
    case 'lista_inscritos': return { label: 'Lista de inscritos', icon: 'people' };
    case 'convocacao': return { label: 'Convocação', icon: 'campaign' };
    case 'comunicado': return { label: 'Comunicado', icon: 'info-outline' };
    case 'recurso': return { label: 'Recurso', icon: 'replay' };
    default: return { label: 'Documento', icon: 'insert-drive-file' };
  }
}

export function PublicationCard({ pub }: { pub: ConcursoPublication }) {
  const theme = useAppTheme();
  const styles = createStyles(theme);
  const config = getPublicationTypeConfig(pub.publication_type);
  
  const dateStr = pub.publication_date 
    ? new Date(pub.publication_date).toLocaleDateString('pt-BR') 
    : 'Data não informada';

  const handleOpen = () => {
    if (pub.link) {
      Linking.openURL(pub.link);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <MaterialIcons name={config.icon as any} size={24} color={theme.colors.primary} />
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.type}>{config.label}</Text>
          <Text style={styles.date}>{dateStr}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{pub.title}</Text>
      </View>
      <Pressable style={styles.openBtn} onPress={handleOpen} disabled={!pub.link}>
        <MaterialIcons name="open-in-new" size={20} color={pub.link ? theme.colors.primary : theme.colors.mutedText} />
      </Pressable>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surfaceLowest,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.surfaceHighest,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  type: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.primary,
    textTransform: 'uppercase',
  },
  date: {
    fontSize: 12,
    color: theme.colors.mutedText,
  },
  title: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  openBtn: {
    padding: 8,
  }
});
