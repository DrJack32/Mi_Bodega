import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Wine, useWines } from '@/contexts/WineContext';

const WINE_TYPE_COLORS: Record<string, string> = {
  tinto: '#7B2D3E',
  blanco: '#C4974A',
  rosado: '#D4788A',
  espumoso: '#5B8C9E',
  generoso: '#8B6914',
  dulce: '#9B4FAB',
  orange: '#C86E2A',
  otro: '#6B7280',
};

const WINE_TYPE_LABELS: Record<string, string> = {
  tinto: 'Tinto',
  blanco: 'Blanco',
  rosado: 'Rosado',
  espumoso: 'Espumoso',
  generoso: 'Generoso',
  dulce: 'Dulce',
  orange: 'Orange',
  otro: 'Otro',
};

interface WineCardProps {
  wine: Wine;
  style?: object;
}

export function WineCard({ wine, style }: WineCardProps) {
  const colors = useColors();
  const router = useRouter();
  const { toggleFavorite } = useWines();
  const typeColor = WINE_TYPE_COLORS[wine.type] ?? '#6B7280';

  const handleFavorite = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite(wine.id);
  };

  return (
    <Pressable
      onPress={() => router.push(`/wine/${wine.id}`)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      <View style={styles.photoContainer}>
        {wine.photos[0] ? (
          <Image
            source={{ uri: wine.photos[0] }}
            style={styles.photo}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.photoPlaceholder, { backgroundColor: colors.secondary }]}>
            <Ionicons name="wine" size={32} color={typeColor} />
          </View>
        )}
        <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
          <Text style={styles.typeText}>{WINE_TYPE_LABELS[wine.type] ?? 'Otro'}</Text>
        </View>
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>
          {wine.name || 'Sin nombre'}
        </Text>
        {wine.winery ? (
          <Text style={[styles.winery, { color: colors.mutedForeground }]} numberOfLines={1}>
            {wine.winery}
          </Text>
        ) : null}
        <View style={styles.footer}>
          <View style={styles.details}>
            {wine.vintage ? (
              <Text style={[styles.detail, { color: colors.mutedForeground }]}>{wine.vintage}</Text>
            ) : null}
            {wine.country ? (
              <Text style={[styles.detail, { color: colors.mutedForeground }]}>· {wine.country}</Text>
            ) : null}
          </View>
          <View style={styles.footerRight}>
            {wine.rating > 0 ? (
              <View style={[styles.ratingBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.ratingText}>{wine.rating}</Text>
              </View>
            ) : null}
            <Pressable onPress={handleFavorite} hitSlop={8}>
              <Ionicons
                name={wine.isFavorite ? 'heart' : 'heart-outline'}
                size={18}
                color={wine.isFavorite ? '#E74C3C' : colors.mutedForeground}
              />
            </Pressable>
          </View>
        </View>
        {wine.price ? (
          <Text style={[styles.price, { color: colors.accent }]}>{wine.price} €</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  photoContainer: {
    height: 160,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  typeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.5,
  },
  info: {
    padding: 12,
    gap: 4,
  },
  name: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 20,
  },
  winery: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  details: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },
  detail: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  price: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 2,
  },
});
