import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { WineFormData, WineType } from '@/contexts/WineContext';

const WINE_TYPES: { value: WineType; label: string; color: string }[] = [
  { value: 'tinto', label: 'Tinto', color: '#7B2D3E' },
  { value: 'blanco', label: 'Blanco', color: '#C4974A' },
  { value: 'rosado', label: 'Rosado', color: '#D4788A' },
  { value: 'espumoso', label: 'Espumoso', color: '#5B8C9E' },
  { value: 'generoso', label: 'Generoso', color: '#8B6914' },
  { value: 'dulce', label: 'Dulce', color: '#9B4FAB' },
  { value: 'orange', label: 'Orange', color: '#C86E2A' },
  { value: 'otro', label: 'Otro', color: '#6B7280' },
];

const EMPTY_FORM: WineFormData = {
  photos: [],
  name: '',
  winery: '',
  vintage: '',
  type: 'tinto',
  country: '',
  region: '',
  denomination: '',
  grapes: '',
  alcohol: '',
  volume: '750ml',
  date: '',
  location: '',
  price: '',
  rating: 0,
  wouldRepeat: null,
  notes: '',
  isFavorite: false,
  ocrUsed: false,
};

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : 'http://localhost:80';

async function callOCR(base64: string): Promise<Partial<WineFormData>> {
  const response = await fetch(`${API_BASE}/api/ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64 }),
  });
  if (!response.ok) throw new Error('OCR failed');
  const data = await response.json() as { fields: Partial<WineFormData> };
  return data.fields ?? {};
}

interface WineFormProps {
  initialValues?: Partial<WineFormData>;
  onSave: (data: WineFormData) => Promise<void>;
  onCancel: () => void;
  onScanPress?: () => void;
}

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <View style={[styles.sectionHeader, { borderLeftColor: colors.primary }]}>
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>{title}</Text>
    </View>
  );
}

function FieldLabel({ label, optional }: { label: string; optional?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      {optional && <Text style={[styles.optionalTag, { color: colors.mutedForeground }]}>opcional</Text>}
    </View>
  );
}

export function WineForm({ initialValues, onSave, onCancel }: WineFormProps) {
  const colors = useColors();
  const [form, setForm] = useState<WineFormData>({ ...EMPTY_FORM, ...initialValues });
  const [isSaving, setIsSaving] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);

  function set<K extends keyof WineFormData>(key: K, value: WineFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  const runOCROnImage = async (uri: string, base64: string) => {
    setIsOcrLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const fields = await callOCR(base64);
      setForm(prev => ({
        ...prev,
        ...fields,
        photos: [uri, ...prev.photos],
        ocrUsed: true,
      }));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(
        'OCR no disponible',
        'No se pudo extraer la información. La foto se ha añadido igualmente.',
      );
      setForm(prev => ({ ...prev, photos: [uri, ...prev.photos] }));
    } finally {
      setIsOcrLoading(false);
    }
  };

  const pickAndScan = async (fromCamera: boolean) => {
    try {
      let result: ImagePicker.ImagePickerResult;
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: 0.65,
        base64: true,
        allowsEditing: false,
      };
      if (fromCamera) {
        result = await ImagePicker.launchCameraAsync(opts);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(opts);
      }
      if (!result.canceled && result.assets[0]) {
        await runOCROnImage(result.assets[0].uri, result.assets[0].base64 ?? '');
      }
    } catch {
      Alert.alert('Error', 'No se pudo acceder a la cámara o galería.');
    }
  };

  const pickPhotoOnly = async (fromCamera: boolean) => {
    try {
      let result: ImagePicker.ImagePickerResult;
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: true,
        aspect: [3, 4],
      };
      if (fromCamera) {
        result = await ImagePicker.launchCameraAsync(opts);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(opts);
      }
      if (!result.canceled && result.assets[0]) {
        set('photos', [...form.photos, result.assets[0].uri]);
      }
    } catch {
      Alert.alert('Error', 'No se pudo acceder a la cámara o galería.');
    }
  };

  const handleScanPress = () => {
    if (Platform.OS === 'web') {
      pickAndScan(false);
      return;
    }
    Alert.alert(
      'Escanear etiqueta',
      'Elige cómo quieres escanear la etiqueta para extraer la información automáticamente',
      [
        { text: 'Cámara', onPress: () => pickAndScan(true) },
        { text: 'Desde galería', onPress: () => pickAndScan(false) },
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  };

  const handleAddPhotoOnly = () => {
    if (Platform.OS === 'web') {
      pickPhotoOnly(false);
      return;
    }
    Alert.alert('Añadir foto', 'Solo añadir foto sin extraer información', [
      { text: 'Cámara', onPress: () => pickPhotoOnly(true) },
      { text: 'Galería', onPress: () => pickPhotoOnly(false) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const removePhoto = (index: number) => {
    set('photos', form.photos.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!form.name.trim() && !form.winery.trim()) {
      Alert.alert('Campos requeridos', 'Por favor añade al menos el nombre del vino o la bodega.');
      return;
    }
    try {
      setIsSaving(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await onSave(form);
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius / 1.5 }];
  const textAreaStyle = [styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius / 1.5 }];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={onCancel} style={styles.headerBtn}>
          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancelar</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {initialValues?.name ? 'Editar vino' : 'Nuevo vino'}
        </Text>
        <Pressable onPress={handleSave} disabled={isSaving || isOcrLoading} style={[styles.saveBtn, { backgroundColor: colors.primary, borderRadius: colors.radius / 1.5, opacity: (isSaving || isOcrLoading) ? 0.6 : 1 }]}>
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.saveText}>Guardar</Text>
          )}
        </Pressable>
      </View>

      {/* OCR loading overlay banner */}
      {isOcrLoading && (
        <View style={[styles.ocrLoadingBanner, { backgroundColor: colors.primary }]}>
          <ActivityIndicator size="small" color="#FFF" />
          <Text style={styles.ocrLoadingText}>Analizando etiqueta con OCR...</Text>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* OCR extraction result banner */}
        {form.ocrUsed && (
          <View style={[styles.ocrBanner, { backgroundColor: '#EAF6EC', borderRadius: colors.radius / 1.5, borderColor: '#27AE60' }]}>
            <Ionicons name="checkmark-circle" size={18} color="#27AE60" />
            <Text style={[styles.ocrBannerText, { color: '#1D7A3A' }]}>
              ¡Info extraída por OCR! Revisa y completa los campos que quieras.
            </Text>
          </View>
        )}

        {/* FOTO Y ESCANEO — sección principal */}
        <SectionHeader title="Foto y escaneo" />

        {/* Scan button — primary CTA */}
        <Pressable
          onPress={handleScanPress}
          disabled={isOcrLoading}
          style={({ pressed }) => [
            styles.scanButton,
            { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed || isOcrLoading ? 0.8 : 1 },
          ]}
        >
          <View style={styles.scanIconBox}>
            <Ionicons name="scan-circle" size={36} color="rgba(255,255,255,0.9)" />
          </View>
          <View style={styles.scanTextBox}>
            <Text style={styles.scanTitle}>Escanear etiqueta</Text>
            <Text style={styles.scanSubtitle}>Extrae automáticamente: añada, bodega, uvas, alcohol y más</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
        </Pressable>

        {/* Photos row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow} contentContainerStyle={styles.photosContent}>
          {form.photos.map((uri, i) => (
            <View key={i} style={styles.photoWrapper}>
              <Image source={{ uri }} style={styles.photoThumb} contentFit="cover" />
              <Pressable
                onPress={() => removePhoto(i)}
                style={[styles.removePhotoBtn, { backgroundColor: colors.destructive }]}
              >
                <Ionicons name="close" size={12} color="#FFF" />
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={handleAddPhotoOnly}
            style={[styles.addPhotoBtn, { borderColor: colors.border, borderRadius: colors.radius }]}
          >
            <Ionicons name="image-outline" size={22} color={colors.mutedForeground} />
            <Text style={[styles.addPhotoText, { color: colors.mutedForeground }]}>Solo foto</Text>
          </Pressable>
        </ScrollView>

        {/* Datos del vino */}
        <SectionHeader title="Datos del vino" />

        <FieldLabel label="Nombre del vino" />
        <TextInput
          style={inputStyle}
          value={form.name}
          onChangeText={v => set('name', v)}
          placeholder="Ej: Vega Sicilia Único"
          placeholderTextColor={colors.mutedForeground}
        />

        <FieldLabel label="Bodega" />
        <TextInput
          style={inputStyle}
          value={form.winery}
          onChangeText={v => set('winery', v)}
          placeholder="Ej: Bodegas Vega Sicilia"
          placeholderTextColor={colors.mutedForeground}
        />

        <View style={styles.row}>
          <View style={styles.half}>
            <FieldLabel label="Añada" optional />
            <TextInput
              style={inputStyle}
              value={form.vintage}
              onChangeText={v => set('vintage', v)}
              placeholder="2019"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
          <View style={styles.half}>
            <FieldLabel label="Graduación" optional />
            <TextInput
              style={inputStyle}
              value={form.alcohol}
              onChangeText={v => set('alcohol', v)}
              placeholder="13.5%"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <FieldLabel label="Tipo de vino" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow} contentContainerStyle={styles.typeContent}>
          {WINE_TYPES.map(({ value, label, color }) => (
            <Pressable
              key={value}
              onPress={() => set('type', value)}
              style={[
                styles.typeChip,
                {
                  backgroundColor: form.type === value ? color : colors.secondary,
                  borderRadius: 20,
                  borderColor: form.type === value ? color : colors.border,
                },
              ]}
            >
              <Text style={[styles.typeChipText, { color: form.type === value ? '#FFF' : colors.mutedForeground }]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.row}>
          <View style={styles.half}>
            <FieldLabel label="País" optional />
            <TextInput
              style={inputStyle}
              value={form.country}
              onChangeText={v => set('country', v)}
              placeholder="España"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
          <View style={styles.half}>
            <FieldLabel label="Región" optional />
            <TextInput
              style={inputStyle}
              value={form.region}
              onChangeText={v => set('region', v)}
              placeholder="La Rioja"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
        </View>

        <FieldLabel label="Denominación de origen" optional />
        <TextInput
          style={inputStyle}
          value={form.denomination}
          onChangeText={v => set('denomination', v)}
          placeholder="DOCa Rioja"
          placeholderTextColor={colors.mutedForeground}
        />

        <FieldLabel label="Variedades de uva" optional />
        <TextInput
          style={inputStyle}
          value={form.grapes}
          onChangeText={v => set('grapes', v)}
          placeholder="Tempranillo, Garnacha..."
          placeholderTextColor={colors.mutedForeground}
        />

        {/* Mi cata */}
        <SectionHeader title="Mi cata" />

        <View style={styles.row}>
          <View style={styles.half}>
            <FieldLabel label="Fecha" optional />
            <TextInput
              style={inputStyle}
              value={form.date}
              onChangeText={v => set('date', v)}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={styles.half}>
            <FieldLabel label="Precio (€)" optional />
            <TextInput
              style={inputStyle}
              value={form.price}
              onChangeText={v => set('price', v)}
              placeholder="12.50"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <FieldLabel label="Lugar" optional />
        <TextInput
          style={inputStyle}
          value={form.location}
          onChangeText={v => set('location', v)}
          placeholder="Restaurante, casa, viaje..."
          placeholderTextColor={colors.mutedForeground}
        />

        <FieldLabel label="Puntuación (1-10)" optional />
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <Pressable
              key={n}
              onPress={() => {
                set('rating', form.rating === n ? 0 : n);
                Haptics.selectionAsync();
              }}
              style={[
                styles.ratingDot,
                {
                  backgroundColor: form.rating >= n ? colors.primary : colors.secondary,
                  borderRadius: 8,
                },
              ]}
            >
              <Text style={[styles.ratingDotText, { color: form.rating >= n ? '#FFF' : colors.mutedForeground }]}>
                {n}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.toggleRow, { borderColor: colors.border }]}>
          <Text style={[styles.toggleLabel, { color: colors.foreground }]}>¿Lo repetiría?</Text>
          <View style={styles.toggleOptions}>
            <Pressable
              onPress={() => set('wouldRepeat', form.wouldRepeat === true ? null : true)}
              style={[
                styles.toggleBtn,
                { backgroundColor: form.wouldRepeat === true ? '#27AE60' : colors.secondary, borderRadius: colors.radius / 2 },
              ]}
            >
              <Text style={[styles.toggleBtnText, { color: form.wouldRepeat === true ? '#FFF' : colors.mutedForeground }]}>Sí</Text>
            </Pressable>
            <Pressable
              onPress={() => set('wouldRepeat', form.wouldRepeat === false ? null : false)}
              style={[
                styles.toggleBtn,
                { backgroundColor: form.wouldRepeat === false ? colors.destructive : colors.secondary, borderRadius: colors.radius / 2 },
              ]}
            >
              <Text style={[styles.toggleBtnText, { color: form.wouldRepeat === false ? '#FFF' : colors.mutedForeground }]}>No</Text>
            </Pressable>
          </View>
        </View>

        <FieldLabel label="Notas personales" optional />
        <TextInput
          style={textAreaStyle}
          value={form.notes}
          onChangeText={v => set('notes', v)}
          placeholder="Aromas, sabores, maridaje, impresiones..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn: { minWidth: 70 },
  headerTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  cancelText: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  saveText: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  ocrLoadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ocrLoadingText: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_500Medium' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 10 },
  ocrBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderWidth: 1,
  },
  ocrBannerText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', lineHeight: 18 },
  sectionHeader: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginTop: 8,
    marginBottom: 2,
  },
  sectionTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, textTransform: 'uppercase' },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  optionalTag: { fontSize: 11, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    marginBottom: 12,
  },
  scanIconBox: { width: 44, alignItems: 'center' },
  scanTextBox: { flex: 1 },
  scanTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  scanSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  photosRow: { marginBottom: 4 },
  photosContent: { gap: 10, paddingVertical: 4 },
  photoWrapper: { position: 'relative' },
  photoThumb: { width: 80, height: 100, borderRadius: 8 },
  removePhotoBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoBtn: {
    width: 80,
    height: 100,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  textArea: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    minHeight: 100,
  },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  typeRow: { marginBottom: 4 },
  typeContent: { gap: 8, paddingBottom: 4 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  typeChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  ratingRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  ratingDot: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingDotText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  toggleLabel: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  toggleOptions: { flexDirection: 'row', gap: 8 },
  toggleBtn: { paddingHorizontal: 20, paddingVertical: 8 },
  toggleBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  bottomPad: { height: 40 },
});
