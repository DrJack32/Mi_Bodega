import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WineCard } from '@/components/WineCard';
import { Wine, WineType, useWines } from '@/contexts/WineContext';
import { useColors } from '@/hooks/useColors';

const FILTER_OPTIONS: { label: string; value: WineType | 'all' }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Tinto', value: 'tinto' },
  { label: 'Blanco', value: 'blanco' },
  { label: 'Rosado', value: 'rosado' },
  { label: 'Espumoso', value: 'espumoso' },
  { label: 'Otros', value: 'otro' },
];

const SORT_OPTIONS = [
  { label: 'Recientes', value: 'recent' },
  { label: 'Puntuación', value: 'rating' },
  { label: 'Precio', value: 'price' },
  { label: 'Nombre', value: 'name' },
];

export default function BibliotecaScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { wines } = useWines();
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [filterType, setFilterType] = useState<WineType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'rating' | 'price' | 'name'>('recent');

  const filtered = useMemo(() => {
    let list = [...wines];

    if (filterType !== 'all') {
      list = list.filter(w => {
        if (filterType === 'otro') return !['tinto', 'blanco', 'rosado', 'espumoso'].includes(w.type);
        return w.type === filterType;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(w =>
        w.name.toLowerCase().includes(q) ||
        w.winery.toLowerCase().includes(q) ||
        w.country.toLowerCase().includes(q) ||
        w.region.toLowerCase().includes(q) ||
        w.denomination.toLowerCase().includes(q) ||
        w.grapes.toLowerCase().includes(q) ||
        w.vintage.includes(q)
      );
    }

    list.sort((a, b) => {
      switch (sortBy) {
        case 'rating': return b.rating - a.rating;
        case 'price': return parseFloat(b.price || '0') - parseFloat(a.price || '0');
        case 'name': return a.name.localeCompare(b.name);
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return list;
  }, [wines, search, filterType, sortBy]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.primary }]}>Mi Bodega</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {wines.length} {wines.length === 1 ? 'vino' : 'vinos'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => { setShowSearch(s => !s); if (showSearch) setSearch(''); }}
              style={[styles.iconBtn, { backgroundColor: colors.secondary, borderRadius: 20 }]}
            >
              <Ionicons name={showSearch ? 'close' : 'search'} size={20} color={colors.foreground} />
            </Pressable>
          </View>
        </View>

        {showSearch && (
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar vino, bodega, uva, país..."
            placeholderTextColor={colors.mutedForeground}
            autoFocus
            returnKeyType="search"
          />
        )}

        <FlatList
          data={FILTER_OPTIONS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={i => i.value}
          style={styles.filterList}
          renderItem={({ item }) => {
            const active = filterType === item.value;
            return (
              <Pressable
                onPress={() => setFilterType(item.value)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? colors.primary : colors.secondary,
                    borderRadius: 20,
                  },
                ]}
              >
                <Text style={[styles.filterChipText, { color: active ? '#FFF' : colors.mutedForeground }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />

        <FlatList
          data={SORT_OPTIONS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={i => i.value}
          style={styles.sortList}
          renderItem={({ item }) => {
            const active = sortBy === item.value;
            return (
              <Pressable
                onPress={() => setSortBy(item.value as typeof sortBy)}
                style={[styles.sortChip, { borderColor: active ? colors.primary : colors.border }]}
              >
                <Text style={[styles.sortChipText, { color: active ? colors.primary : colors.mutedForeground }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={filtered}
        numColumns={2}
        keyExtractor={w => w.id}
        contentContainerStyle={[styles.grid, { paddingBottom: bottomPad + 100 }]}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        scrollEnabled={filtered.length > 0}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="wine-outline" size={56} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {search || filterType !== 'all' ? 'Sin resultados' : 'Tu bodega está vacía'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {search || filterType !== 'all'
                ? 'Prueba con otros filtros'
                : 'Pulsa + para añadir tu primer vino'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <WineCard wine={item} style={styles.card} />
        )}
      />

      <Pressable
        onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push('/add-wine');
        }}
        style={[
          styles.fab,
          { backgroundColor: colors.primary, borderRadius: 30, bottom: bottomPad + (Platform.OS === 'web' ? 84 : 80) },
        ]}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  iconBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  searchInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    marginBottom: 10,
  },
  filterList: { marginBottom: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
  filterChipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  sortList: { marginBottom: 4 },
  sortChip: { paddingHorizontal: 12, paddingVertical: 5, marginRight: 8, borderWidth: 1, borderRadius: 12 },
  sortChipText: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  grid: { padding: 12 },
  row: { gap: 12, marginBottom: 12 },
  card: { flex: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
