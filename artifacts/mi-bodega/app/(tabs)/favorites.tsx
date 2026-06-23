import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WineCard } from '@/components/WineCard';
import { useWines } from '@/contexts/WineContext';
import { useColors } from '@/hooks/useColors';
import * as Haptics from 'expo-haptics';

export default function FavoritosScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { wines } = useWines();
  const favorites = wines.filter(w => w.isFavorite);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.primary }]}>Favoritos</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {favorites.length} {favorites.length === 1 ? 'vino' : 'vinos'}
        </Text>
      </View>

      <FlatList
        data={favorites}
        numColumns={2}
        keyExtractor={w => w.id}
        contentContainerStyle={[styles.grid, { paddingBottom: bottomPad + 20 }]}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        scrollEnabled={favorites.length > 0}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={56} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sin favoritos</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Pulsa el corazón en un vino para marcarlo como favorito
            </Text>
            <Pressable
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/add-wine');
              }}
              style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
            >
              <Ionicons name="add" size={20} color="#FFF" />
              <Text style={styles.addBtnText}>Añadir vino</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => <WineCard wine={item} style={styles.card} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  grid: { padding: 12 },
  row: { gap: 12, marginBottom: 12 },
  card: { flex: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 14, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  addBtnText: { color: '#FFF', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
