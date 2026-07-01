import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWines } from '@/contexts/WineContext';
import { useColors } from '@/hooks/useColors';

function downloadOnWeb(filename: string, content: string) {
  if (typeof document === 'undefined') return false;

  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}

export default function DatosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { wines, createBackup, restoreBackup } = useWines();
  const [restoreText, setRestoreText] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const backupName = useMemo(() => {
    const stamp = new Date().toISOString().slice(0, 10);
    return `mi-bodega-backup-${stamp}.json`;
  }, []);

  const exportData = async () => {
    try {
      const backup = createBackup();
      if (Platform.OS === 'web') {
        downloadOnWeb(backupName, backup);
      } else {
        await Share.share({
          title: backupName,
          message: backup,
        });
      }
    } catch {
      Alert.alert('Error', 'No se pudo crear la copia de seguridad.');
    }
  };

  const doRestore = async () => {
    try {
      setIsBusy(true);
      const count = await restoreBackup(restoreText);
      setRestoreText('');
      Alert.alert('Copia restaurada', `Se han restaurado ${count} vinos.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'El contenido no es valido.';
      Alert.alert('No se pudo restaurar', message);
    } finally {
      setIsBusy(false);
    }
  };

  const confirmRestore = () => {
    if (!restoreText.trim()) {
      Alert.alert('Sin datos', 'Introduce el contenido de una copia de seguridad.');
      return;
    }

    if (Platform.OS === 'web') {
      if (window.confirm('Restaurar esta copia sustituira los datos actuales.')) {
        doRestore();
      }
      return;
    }

    Alert.alert(
      'Restaurar copia',
      'Esta accion sustituira los datos actuales.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Restaurar', style: 'destructive', onPress: doRestore },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.primary }]}>Datos</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          {wines.length} {wines.length === 1 ? 'vino guardado' : 'vinos guardados'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <View style={styles.panelHeader}>
            <Ionicons name="download-outline" size={22} color={colors.primary} />
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>Copia de seguridad</Text>
          </View>
          <Pressable
            onPress={exportData}
            style={[styles.primaryButton, { backgroundColor: colors.primary, borderRadius: colors.radius / 1.5 }]}
          >
            <Ionicons name="download" size={18} color="#FFF" />
            <Text style={styles.primaryButtonText}>Descargar copia</Text>
          </Pressable>
        </View>

        <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <View style={styles.panelHeader}>
            <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>Restaurar</Text>
          </View>
          <TextInput
            value={restoreText}
            onChangeText={setRestoreText}
            placeholder="JSON de copia"
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.restoreInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.foreground,
                borderRadius: colors.radius / 1.5,
              },
            ]}
          />
          <Pressable
            onPress={confirmRestore}
            disabled={isBusy}
            style={[
              styles.secondaryButton,
              {
                borderColor: colors.primary,
                borderRadius: colors.radius / 1.5,
                opacity: isBusy ? 0.5 : 1,
              },
            ]}
          >
            <Ionicons name="refresh" size={18} color={colors.primary} />
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Restaurar copia</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  content: { padding: 16, gap: 14 },
  panel: { borderWidth: 1, padding: 16, gap: 14 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  panelTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  primaryButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryButtonText: { color: '#FFF', fontSize: 15, fontFamily: 'Inter_700Bold' },
  restoreInput: {
    minHeight: 180,
    borderWidth: 1,
    padding: 12,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  secondaryButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  secondaryButtonText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});
