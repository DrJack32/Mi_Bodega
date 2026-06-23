import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useRef, useState } from 'react';
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
  : '';

async function callOCR(base64: string): Promise<Partial<WineFormData>> {
  const url = `${API_BASE}/api/ocr`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64 }),
  });
  if (!response.ok) throw new Error(`OCR HTTP ${response.status}`);
  const data = await response.json() as { fields?: Partial<WineFormData>; error?: string };
  if (data.error) throw new Error(data.error);
  return data.fields ?? {};
}

interface WineFormProps {
  initialValues?: Partial<WineFormData>;
  onSave: (data: WineFormData) => Promise<void>;
  onCancel: () => void;
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
  const [ocrPhotoIndex, setOcrPhotoIndex] = useState<number | null>(null);

  // Store base64 data keyed by photo URI for OCR
  const base64Cache = useRef<Map<string, string>>(new Map());

  function set<K extends keyof WineFormData>(key: K, value: WineFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  const addPhoto = async (fromCamera: boolean) => {
    try {
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: 0.65,
        base64: true,
        allowsEditing: false,
      };
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);

      if (!result.canceled && result.assets[0]) {
        const { uri, base64 } = result.assets[0];
        if (base64) base64Cache.current.set(uri, base64);
        setForm(prev => ({ ...prev, photos: [...prev.photos, uri] }));
      }
    } catch {
      Alert.alert('Error', 'No se pudo acceder a la cámara o galería.');
    }
  };

  const handleAddPhoto = () => {
    if (Platform.OS === 'web') {
      addPhoto(false);
      return;
    }
    Alert.alert('Añadir foto', 'Elige una opción', [
      { text: 'Cámara', onPress: () => addPhoto(true) },
      { text: 'Galería', onPress: () => addPhoto(false) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const runOCROnPhoto = async (uri: string, index: number) => {
    const base64 = base64Cache.current.get(uri);
    if (!base64) {
      Alert.alert(
        'Sin datos de imagen',
        'No se puede leer esta foto para el OCR. Añade una foto nueva con el botón de cámara/galería.',
      );
      return;
    }

    setIsOcrLoading(true);
    setOcrPhotoIndex(index);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const fields = await callOCR(base64);
      const hasData = Object.keys(fields).length > 0;
      setForm(prev => ({
        ...prev,
        ...(hasData ? fields : {}),
        ocrUsed: hasData,
      }));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!hasData) {
        Alert.alert(
          'Poco texto detectado',
          'No se pudo extraer información de esta foto. Prueba con una foto más nítida de la etiqueta frontal del vino.',
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Error al extraer información', `${msg}\n\nComprueba tu conexión e inténtalo de nuevo.`);
    } finally {
      setIsOcrLoading(false);
      setOcrPhotoIndex(null);
    }
  };

  const removePhoto = (index: number) => {
    const uri = form.photos[index];
    base64Cache.current.delete(uri);
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

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius / 1.5 },
  ];
  const textAreaStyle = [
    styles.textArea,
    { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius / 1.5 },
  ];

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
        <Pressable
          onPress={handleSave}
          disabled={isSaving || isOcrLoading}
          style={[
            styles.saveBtn,
            { backgroundColor: colors.primary, borderRadius: colors.radius / 1.5, opacity: isSaving || isOcrLoading ? 0.5 : 1 },
          ]}
        >
          {isSaving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveText}>Guardar</Text>}
        </Pressable>
      </View>

      {/* OCR in-progress banner */}
      {isOcrLoading && (
        <View style={[styles.ocrProgressBar, { backgroundColor: colors.primary }]}>
          <ActivityIndicator size="small" color="#FFF" />
          <Text style={styles.ocrProgressText}>Analizando etiqueta con OCR…</Text>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Success banner after OCR */}
        {form.ocrUsed && (
          <View style={[styles.ocrSuccessBanner, { borderRadius: colors.radius / 1.5 }]}>
            <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
            <Text style={styles.ocrSuccessText}>
              ¡Información extraída! Revisa y completa los campos.
            </Text>
          </View>
        )}

        {/* ── FOTO ─────────────────────────────── */}
        <SectionHeader title="Foto de la etiqueta" />

        {/* Add photo button */}
        <Pressable
          onPress={handleAddPhoto}
          style={[styles.addPhotoRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
        >
          <View style={[styles.addPhotoIconBox, { backgroundColor: colors.secondary }]}>
            <Ionicons name="camera" size={22} color={colors.primary} />
          </View>
          <Text style={[styles.addPhotoLabel, { color: colors.foreground }]}>Añadir foto de la etiqueta</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </Pressable>

        {/* Photos list with OCR buttons */}
        {form.photos.length > 0 && (
          <View style={styles.photosGrid}>
            {form.photos.map((uri, i) => {
              const hasBase64 = base64Cache.current.has(uri);
              const isThisLoading = isOcrLoading && ocrPhotoIndex === i;
              return (
                <View key={uri + i} style={[styles.photoCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <Image source={{ uri }} style={styles.photoImage} contentFit="cover" />

                  <View style={styles.photoCardActions}>
                    {/* OCR extraction button — main CTA */}
                    {hasBase64 && (
                      <Pressable
                        onPress={() => runOCROnPhoto(uri, i)}
                        disabled={isOcrLoading}
                        style={[
                          styles.extractBtn,
                          { backgroundColor: isOcrLoading ? colors.muted : colors.primary, borderRadius: 8, opacity: isOcrLoading ? 0.6 : 1 },
                        ]}
                      >
                        {isThisLoading ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <Ionicons name="scan-outline" size={16} color="#FFF" />
                        )}
                        <Text style={styles.extractBtnText}>
                          {isThisLoading ? 'Analizando…' : 'Extraer información'}
                        </Text>
                      </Pressable>
                    )}

                    <Pressable onPress={() => removePhoto(i)} style={[styles.removeBtn, { backgroundColor: colors.destructive }]}>
                      <Ionicons name="trash-outline" size={14} color="#FFF" />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── DATOS DEL VINO ────────────────────── */}
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          {WINE_TYPES.map(({ value, label, color }) => (
            <Pressable
              key={value}
              onPress={() => set('type', value)}
              style={[
                styles.typeChip,
                { backgroundColor: form.type === value ? color : colors.secondary, borderRadius: 20, borderColor: form.type === value ? color : colors.border },
              ]}
            >
              <Text style={[styles.typeChipText, { color: form.type === value ? '#FFF' : colors.mutedForeground }]}>{label}</Text>
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

        {/* ── MI CATA ───────────────────────────── */}
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
              onPress={() => { set('rating', form.rating === n ? 0 : n); Haptics.selectionAsync(); }}
              style={[styles.ratingDot, { backgroundColor: form.rating >= n ? colors.primary : colors.secondary, borderRadius: 8 }]}
            >
              <Text style={[styles.ratingDotText, { color: form.rating >= n ? '#FFF' : colors.mutedForeground }]}>{n}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.toggleRow, { borderColor: colors.border }]}>
          <Text style={[styles.toggleLabel, { color: colors.foreground }]}>¿Lo repetiría?</Text>
          <View style={styles.toggleOptions}>
            <Pressable
              onPress={() => set('wouldRepeat', form.wouldRepeat === true ? null : true)}
              style={[styles.toggleBtn, { backgroundColor: form.wouldRepeat === true ? '#27AE60' : colors.secondary, borderRadius: colors.radius / 2 }]}
            >
              <Text style={[styles.toggleBtnText, { color: form.wouldRepeat === true ? '#FFF' : colors.mutedForeground }]}>Sí</Text>
            </Pressable>
            <Pressable
              onPress={() => set('wouldRepeat', form.wouldRepeat === false ? null : false)}
              style={[styles.toggleBtn, { backgroundColor: form.wouldRepeat === false ? colors.destructive : colors.secondary, borderRadius: colors.radius / 2 }]}
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

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerBtn: { minWidth: 70 },
  headerTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  cancelText: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  saveText: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  ocrProgressBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  ocrProgressText: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_500Medium' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 10 },
  ocrSuccessBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, backgroundColor: '#EAF6EC', borderWidth: 1, borderColor: '#A8D5B5' },
  ocrSuccessText: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: '#1D7A3A', lineHeight: 18 },
  sectionHeader: { borderLeftWidth: 3, paddingLeft: 10, marginTop: 8, marginBottom: 2 },
  sectionTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, textTransform: 'uppercase' },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  optionalTag: { fontSize: 11, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  addPhotoRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderWidth: 1 },
  addPhotoIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  addPhotoLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium' },
  photosGrid: { gap: 12 },
  photoCard: { overflow: 'hidden', borderWidth: 1 },
  photoImage: { width: '100%', height: 200 },
  photoCardActions: { padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  extractBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 16 },
  extractBtnText: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_700Bold' },
  removeBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: 'Inter_400Regular' },
  textArea: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: 'Inter_400Regular', minHeight: 100 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  typeChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  ratingRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  ratingDot: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  ratingDotText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1 },
  toggleLabel: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  toggleOptions: { flexDirection: 'row', gap: 8 },
  toggleBtn: { paddingHorizontal: 20, paddingVertical: 8 },
  toggleBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
