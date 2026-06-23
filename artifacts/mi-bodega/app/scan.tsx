import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { WineFormData } from '@/contexts/WineContext';

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : 'http://localhost:80';

async function runOCR(base64: string): Promise<Partial<WineFormData>> {
  try {
    const response = await fetch(`${API_BASE}/api/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64 }),
    });
    if (!response.ok) throw new Error('OCR failed');
    const data = await response.json() as { fields: Partial<WineFormData> };
    return data.fields ?? {};
  } catch {
    return {};
  }
}

export default function ScanScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const processImage = async (uri: string, base64: string) => {
    setIsProcessing(true);
    setStatus('Analizando etiqueta...');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const fields = await runOCR(base64);
      setStatus('¡Listo!');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      router.replace({
        pathname: '/add-wine',
        params: {
          ocrData: JSON.stringify(fields),
          photoUri: uri,
        },
      });
    } catch {
      setIsProcessing(false);
      setStatus('');
      Alert.alert('Error', 'No se pudo procesar la imagen. Prueba con otra foto más clara.');
    }
  };

  const pickFromCamera = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        await processImage(result.assets[0].uri, result.assets[0].base64 ?? '');
      }
    } catch {
      Alert.alert('Error', 'No se pudo acceder a la cámara.');
    }
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        base64: true,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        await processImage(result.assets[0].uri, result.assets[0].base64 ?? '');
      }
    } catch {
      Alert.alert('Error', 'No se pudo acceder a la galería.');
    }
  };

  if (isProcessing) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <View style={[styles.loadingCard, { backgroundColor: colors.card, borderRadius: colors.radius * 2 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingTitle, { color: colors.foreground }]}>{status}</Text>
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Extrayendo información de la etiqueta...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Escanear etiqueta</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.content, { paddingBottom: bottomPad + 24 }]}>
        <View style={[styles.infoBox, { backgroundColor: colors.secondary, borderRadius: colors.radius }]}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.foreground }]}>
            Haz una foto de la etiqueta frontal. El OCR extraerá automáticamente el nombre, añada, alcohol y otras características.
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ELIGE UNA OPCIÓN</Text>

        <Pressable
          onPress={pickFromCamera}
          style={({ pressed }) => [
            styles.optionCard,
            { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius * 1.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={[styles.optionIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="camera" size={28} color="#FFF" />
          </View>
          <View style={styles.optionInfo}>
            <Text style={[styles.optionTitle, { color: colors.foreground }]}>Hacer una foto</Text>
            <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>
              Usa la cámara para fotografiar la etiqueta ahora
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </Pressable>

        <Pressable
          onPress={pickFromGallery}
          style={({ pressed }) => [
            styles.optionCard,
            { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius * 1.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={[styles.optionIcon, { backgroundColor: colors.accent }]}>
            <Ionicons name="images" size={28} color="#FFF" />
          </View>
          <View style={styles.optionInfo}>
            <Text style={[styles.optionTitle, { color: colors.foreground }]}>Elegir de la galería</Text>
            <Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>
              Selecciona una foto existente de tu galería
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </Pressable>

        <Pressable
          onPress={() => router.replace('/add-wine')}
          style={({ pressed }) => [
            styles.skipBtn,
            { borderColor: colors.border, borderRadius: colors.radius },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Introducir manualmente</Text>
        </Pressable>

        <View style={[styles.disclaimerBox, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
          <Ionicons name="sparkles-outline" size={16} color={colors.mutedForeground} />
          <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
            El OCR usa Tesseract de forma gratuita. Los resultados dependen de la calidad de la foto. Siempre podrás corregir los datos manualmente.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingCard: { padding: 40, alignItems: 'center', gap: 16, width: '100%', maxWidth: 320 },
  loadingTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  loadingText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  content: { flex: 1, padding: 20, gap: 16 },
  infoBox: { flexDirection: 'row', padding: 14, gap: 10, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1, marginTop: 8 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  optionIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  optionInfo: { flex: 1 },
  optionTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  optionDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  skipBtn: { borderWidth: 1, padding: 14, alignItems: 'center', marginTop: 4 },
  skipText: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  disclaimerBox: { flexDirection: 'row', padding: 12, gap: 8, alignItems: 'flex-start' },
  disclaimerText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
});
