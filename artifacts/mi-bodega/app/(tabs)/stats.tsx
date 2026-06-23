import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWines } from '@/contexts/WineContext';
import { useColors } from '@/hooks/useColors';

const TYPE_LABELS: Record<string, string> = {
  tinto: 'Tinto', blanco: 'Blanco', rosado: 'Rosado', espumoso: 'Espumoso',
  generoso: 'Generoso', dulce: 'Dulce', orange: 'Orange', otro: 'Otro',
};
const TYPE_COLORS: Record<string, string> = {
  tinto: '#7B2D3E', blanco: '#C4974A', rosado: '#D4788A', espumoso: '#5B8C9E',
  generoso: '#8B6914', dulce: '#9B4FAB', orange: '#C86E2A', otro: '#6B7280',
};

function StatCard({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <Ionicons name={icon as any} size={24} color={color} />
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function BarRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const colors = useColors();
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <View style={styles.barRow}>
      <Text style={[styles.barLabel, { color: colors.foreground }]} numberOfLines={1}>{label}</Text>
      <View style={[styles.barTrack, { backgroundColor: colors.secondary }]}>
        <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barCount, { color: colors.mutedForeground }]}>{count}</Text>
    </View>
  );
}

export default function EstadisticasScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { wines } = useWines();

  const stats = useMemo(() => {
    const total = wines.length;
    const rated = wines.filter(w => w.rating > 0);
    const avgRating = rated.length > 0 ? (rated.reduce((s, w) => s + w.rating, 0) / rated.length).toFixed(1) : '—';
    const priced = wines.filter(w => parseFloat(w.price) > 0);
    const avgPrice = priced.length > 0
      ? (priced.reduce((s, w) => s + parseFloat(w.price), 0) / priced.length).toFixed(2)
      : '—';
    const totalSpend = priced.reduce((s, w) => s + parseFloat(w.price), 0);

    const byType = Object.entries(
      wines.reduce<Record<string, number>>((acc, w) => { acc[w.type] = (acc[w.type] ?? 0) + 1; return acc; }, {})
    ).sort((a, b) => b[1] - a[1]);

    const byCountry = Object.entries(
      wines.reduce<Record<string, number>>((acc, w) => {
        if (w.country) acc[w.country] = (acc[w.country] ?? 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const topWines = [...wines].filter(w => w.rating > 0).sort((a, b) => b.rating - a.rating).slice(0, 5);

    return { total, avgRating, avgPrice, totalSpend, byType, byCountry, topWines, favorites: wines.filter(w => w.isFavorite).length };
  }, [wines]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.primary }]}>Estadísticas</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsGrid}>
          <StatCard icon="wine" value={String(stats.total)} label="Vinos totales" color={colors.primary} />
          <StatCard icon="star" value={stats.avgRating} label="Puntuación media" color={colors.accent} />
          <StatCard icon="cash-outline" value={stats.avgPrice === '—' ? '—' : `${stats.avgPrice}€`} label="Precio medio" color="#27AE60" />
          <StatCard icon="heart" value={String(stats.favorites)} label="Favoritos" color="#E74C3C" />
        </View>

        {stats.totalSpend > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Gasto total</Text>
            <Text style={[styles.bigNumber, { color: colors.foreground }]}>{stats.totalSpend.toFixed(2)} €</Text>
          </View>
        )}

        {stats.byType.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Por tipo</Text>
            {stats.byType.map(([type, count]) => (
              <BarRow
                key={type}
                label={TYPE_LABELS[type] ?? type}
                count={count}
                total={stats.total}
                color={TYPE_COLORS[type] ?? colors.primary}
              />
            ))}
          </View>
        )}

        {stats.byCountry.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Países más frecuentes</Text>
            {stats.byCountry.map(([country, count]) => (
              <BarRow key={country} label={country} count={count} total={stats.total} color={colors.primary} />
            ))}
          </View>
        )}

        {stats.topWines.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderRadius: colors.radius, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Mejor valorados</Text>
            {stats.topWines.map((w, i) => (
              <View key={w.id} style={[styles.topWineRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Text style={[styles.topWineRank, { color: colors.mutedForeground }]}>#{i + 1}</Text>
                <View style={styles.topWineInfo}>
                  <Text style={[styles.topWineName, { color: colors.foreground }]} numberOfLines={1}>{w.name || w.winery}</Text>
                  {w.winery && w.name ? <Text style={[styles.topWineWinery, { color: colors.mutedForeground }]} numberOfLines={1}>{w.winery}</Text> : null}
                </View>
                <View style={[styles.topWineRating, { backgroundColor: colors.primary }]}>
                  <Text style={styles.topWineRatingText}>{w.rating}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {stats.total === 0 && (
          <View style={styles.empty}>
            <Ionicons name="bar-chart-outline" size={56} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sin datos aún</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Añade vinos para ver tus estadísticas aquí
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1 },
  title: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  content: { padding: 16, gap: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    flex: 1,
    minWidth: 140,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  section: {
    padding: 16,
    gap: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: { fontSize: 13, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.8 },
  bigNumber: { fontSize: 36, fontFamily: 'Inter_700Bold' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 80, fontSize: 13, fontFamily: 'Inter_400Regular' },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barCount: { width: 24, textAlign: 'right', fontSize: 13, fontFamily: 'Inter_500Medium' },
  topWineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  topWineRank: { fontSize: 13, fontFamily: 'Inter_500Medium', width: 24 },
  topWineInfo: { flex: 1 },
  topWineName: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  topWineWinery: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  topWineRating: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  topWineRatingText: { color: '#FFF', fontSize: 13, fontFamily: 'Inter_700Bold' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
