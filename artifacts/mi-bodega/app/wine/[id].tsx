import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useWines } from '@/contexts/WineContext';

const TYPE_LABELS: Record<string, string> = {
  tinto: 'Tinto', blanco: 'Blanco', rosado: 'Rosado', espumoso: 'Espumoso',
  generoso: 'Generoso', dulce: 'Dulce', orange: 'Orange', otro: 'Otro',
};
const TYPE_COLORS: Record<string, string> = {
  tinto: '#7B2D3E', blanco: '#C4974A', rosado: '#D4788A', espumoso: '#5B8C9E',
  generoso: '#8B6914', dulce: '#9B4FAB', orange: '#C86E2A', otro: '#6B7280',
};

function InfoRow({ label, value }: { label: string; value?: string }) {
  const colors = useColors();
  if (!value) return null;
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  const colors = useColors();
  return (
    <View style={[styles.sectionTitle, { borderLeftColor: colors.primary }]}>
      <Text style={[styles.sectionTitleText, { color: colors.primary }]}>{title}</Text>
    </View>
  );
}

export default function WineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getWine, toggleFavorite, deleteWine } = useWines();
  const wine = getWine(id ?? '');
  const [photoIndex, setPhotoIndex] = useState(0);

  if (!wine) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFoundText, { color: colors.foreground }]}>Vino no encontrado</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  const typeColor = TYPE_COLORS[wine.type] ?? colors.primary;
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleDelete = () => {
    Alert.alert(
      'Eliminar vino',
      `¿Estás seguro de que quieres eliminar "${wine.name || wine.winery}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteWine(wine.id);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.photoArea}>
          {wine.photos.length > 0 ? (
            <>
              <Image source={{ uri: wine.photos[photoIndex] }} style={styles.heroPhoto} contentFit="cover" />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                style={StyleSheet.absoluteFill}
              />
              {wine.photos.length > 1 && (
                <View style={styles.photoDots}>
                  {wine.photos.map((_, i) => (
                    <Pressable key={i} onPress={() => setPhotoIndex(i)}>
                      <View style={[styles.photoDot, { backgroundColor: i === photoIndex ? '#FFF' : 'rgba(255,255,255,0.4)' }]} />
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={[styles.photoPlaceholder, { backgroundColor: typeColor }]}>
              <Ionicons name="wine" size={80} color="rgba(255,255,255,0.3)" />
            </View>
          )}

          <View style={[styles.heroOverlay, { paddingTop: topPad + 8 }]}>
            <Pressable
              onPress={() => router.back()}
              style={[styles.circleBtn, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
            >
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </Pressable>
            <View style={styles.heroActions}>
              <Pressable
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  await toggleFavorite(wine.id);
                }}
                style={[styles.circleBtn, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
              >
                <Ionicons
                  name={wine.isFavorite ? 'heart' : 'heart-outline'}
                  size={22}
                  color={wine.isFavorite ? '#FF6B6B' : '#FFF'}
                />
              </Pressable>
              <Pressable
                onPress={() => router.push({ pathname: '/add-wine', params: { editId: wine.id } })}
                style={[styles.circleBtn, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
              >
                <Ionicons name="pencil" size={20} color="#FFF" />
              </Pressable>
              <Pressable
                onPress={handleDelete}
                style={[styles.circleBtn, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
              >
                <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
              </Pressable>
            </View>
          </View>

          <View style={styles.heroBottom}>
            <View style={[styles.typePill, { backgroundColor: typeColor }]}>
              <Text style={styles.typePillText}>{TYPE_LABELS[wine.type] ?? 'Otro'}</Text>
            </View>
            {wine.rating > 0 && (
              <View style={[styles.ratingPill, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                <Ionicons name="star" size={14} color="#F1C40F" />
                <Text style={styles.ratingPillText}>{wine.rating}/10</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.mainInfo}>
          <Text style={[styles.wineName, { color: colors.foreground }]}>{wine.name || 'Sin nombre'}</Text>
          {wine.winery ? <Text style={[styles.winery, { color: colors.primary }]}>{wine.winery}</Text> : null}

          <View style={styles.tagsRow}>
            {wine.vintage ? (
              <View style={[styles.tag, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.tagText, { color: colors.foreground }]}>{wine.vintage}</Text>
              </View>
            ) : null}
            {wine.country ? (
              <View style={[styles.tag, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.tagText, { color: colors.foreground }]}>{wine.country}</Text>
              </View>
            ) : null}
            {wine.denomination ? (
              <View style={[styles.tag, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.tagText, { color: colors.foreground }]}>{wine.denomination}</Text>
              </View>
            ) : null}
          </View>

          {wine.wouldRepeat !== null && (
            <View style={[
              styles.repeatBadge,
              { backgroundColor: wine.wouldRepeat ? 'rgba(39,174,96,0.12)' : 'rgba(192,57,43,0.12)', borderRadius: colors.radius / 2 },
            ]}>
              <Ionicons
                name={wine.wouldRepeat ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={wine.wouldRepeat ? '#27AE60' : '#C0392B'}
              />
              <Text style={[styles.repeatText, { color: wine.wouldRepeat ? '#27AE60' : '#C0392B' }]}>
                {wine.wouldRepeat ? '¡Lo repetiría!' : 'No lo repetiría'}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.contentPad, { paddingBottom: bottomPad + 24 }]}>
          {(wine.region || wine.denomination || wine.grapes || wine.alcohol || wine.volume) && (
            <>
              <SectionTitle title="Datos del vino" />
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <InfoRow label="Región" value={wine.region} />
                <InfoRow label="Denominación" value={wine.denomination} />
                <InfoRow label="Variedades" value={wine.grapes} />
                <InfoRow label="Graduación" value={wine.alcohol} />
                <InfoRow label="Volumen" value={wine.volume} />
              </View>
            </>
          )}

          {(wine.date || wine.location || wine.price) && (
            <>
              <SectionTitle title="Mi cata" />
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <InfoRow label="Fecha" value={wine.date} />
                <InfoRow label="Lugar" value={wine.location} />
                <InfoRow label="Precio" value={wine.price ? `${wine.price} €` : undefined} />
              </View>
            </>
          )}

          {wine.notes ? (
            <>
              <SectionTitle title="Notas personales" />
              <View style={[styles.notesCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <Text style={[styles.notesText, { color: colors.foreground }]}>{wine.notes}</Text>
              </View>
            </>
          ) : null}

          {wine.ocrUsed && (
            <View style={[styles.ocrBanner, { backgroundColor: colors.muted, borderRadius: colors.radius / 2 }]}>
              <Ionicons name="sparkles" size={14} color={colors.mutedForeground} />
              <Text style={[styles.ocrText, { color: colors.mutedForeground }]}>Algunos datos extraídos por OCR</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontSize: 18, fontFamily: 'Inter_500Medium' },
  backText: { fontSize: 16, fontFamily: 'Inter_400Regular' },
  photoArea: { height: 320, position: 'relative' },
  heroPhoto: { width: '100%', height: '100%' },
  photoPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  photoDots: { position: 'absolute', bottom: 60, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  photoDot: { width: 6, height: 6, borderRadius: 3 },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  heroActions: { flexDirection: 'row', gap: 8 },
  circleBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  heroBottom: { position: 'absolute', bottom: 16, left: 16, flexDirection: 'row', gap: 8 },
  typePill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  typePillText: { color: '#FFF', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  ratingPillText: { color: '#FFF', fontSize: 13, fontFamily: 'Inter_700Bold' },
  mainInfo: { padding: 20, gap: 8 },
  wineName: { fontSize: 24, fontFamily: 'Inter_700Bold', lineHeight: 30 },
  winery: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  tagText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  repeatBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
  repeatText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  contentPad: { paddingHorizontal: 16, gap: 12 },
  sectionTitle: { borderLeftWidth: 3, paddingLeft: 10, marginTop: 4, marginBottom: 4 },
  sectionTitleText: { fontSize: 12, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.8 },
  card: { borderWidth: 1, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, gap: 12 },
  infoLabel: { width: 110, fontSize: 13, fontFamily: 'Inter_400Regular' },
  infoValue: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium' },
  notesCard: { borderWidth: 1, padding: 16 },
  notesText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  ocrBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  ocrText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
