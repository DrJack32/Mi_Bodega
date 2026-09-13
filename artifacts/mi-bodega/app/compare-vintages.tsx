import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useWines } from "@/contexts/WineContext";
import { useColors } from "@/hooks/useColors";
import {
  getLatestTasting,
  getWineAverageRating,
  getWineStockCount,
  getWineTastedBottleCount,
  getWineVintageFamily,
} from "@/lib/wineData";

export default function CompareVintagesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { wines, getWine } = useWines();
  const target = getWine(id ?? "");
  const family = target ? getWineVintageFamily(wines, target) : [];
  const bestRating = Math.max(0, ...family.map(getWineAverageRating));
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={23} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.foreground }]}>Comparar añadas</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {target?.name || "Vino"} · {family.length} {family.length === 1 ? "añada" : "añadas"}
          </Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]}>
        {family.length < 2 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="git-compare-outline" size={34} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Todavía no hay otra añada</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Añade otra añada desde la ficha del vino y aparecerá aquí automáticamente.</Text>
          </View>
        ) : (
          family.map((wine) => {
            const rating = getWineAverageRating(wine);
            const latest = getLatestTasting(wine);
            const isBest = rating > 0 && rating === bestRating;
            return (
              <Pressable
                key={wine.id}
                onPress={() => router.push({ pathname: "/wine/[id]", params: { id: wine.id } })}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: isBest ? colors.primary : colors.border,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  {wine.photos[0] ? (
                    <Image source={{ uri: wine.photos[0] }} style={styles.thumbnail} contentFit="cover" />
                  ) : (
                    <View style={[styles.thumbnail, styles.placeholder, { backgroundColor: colors.secondary }]}>
                      <Ionicons name="wine" size={25} color={colors.primary} />
                    </View>
                  )}
                  <View style={styles.cardHeading}>
                    <Text style={[styles.vintage, { color: colors.foreground }]}>{wine.vintage || "Sin añada"}</Text>
                    <Text style={[styles.winery, { color: colors.mutedForeground }]} numberOfLines={1}>{wine.winery || "Bodega no indicada"}</Text>
                  </View>
                  {isBest && (
                    <View style={[styles.bestBadge, { backgroundColor: colors.primary }]}>
                      <Ionicons name="star" size={12} color="#FFF" />
                      <Text style={styles.bestText}>Mejor nota</Text>
                    </View>
                  )}
                </View>

                <View style={styles.metrics}>
                  <Metric label="Nota media" value={rating > 0 ? `${rating.toFixed(1)}/10` : "—"} />
                  <Metric label="Bebidas" value={String(getWineTastedBottleCount(wine))} />
                  <Metric label="En bodega" value={String(getWineStockCount(wine))} />
                </View>

                <View style={[styles.details, { borderTopColor: colors.border }]}>
                  <Text style={[styles.detailText, { color: colors.mutedForeground }]}>
                    {latest?.date || "Sin fecha de cata"}{latest?.location ? ` · ${latest.location}` : ""}
                  </Text>
                  {latest?.notes ? (
                    <Text style={[styles.notes, { color: colors.foreground }]} numberOfLines={3}>{latest.notes}</Text>
                  ) : (
                    <Text style={[styles.notesEmpty, { color: colors.mutedForeground }]}>Sin notas de cata</Text>
                  )}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={[styles.metric, { backgroundColor: colors.secondary }]}>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingBottom: 14, borderBottomWidth: 1 },
  headerButton: { width: 42 },
  headerText: { flex: 1, alignItems: "center" },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, maxWidth: 250 },
  content: { padding: 16, gap: 12 },
  empty: { borderWidth: 1, padding: 28, alignItems: "center", gap: 9, borderRadius: 14 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  emptyText: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular", textAlign: "center" },
  card: { borderWidth: 1.5, padding: 14, gap: 13 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  thumbnail: { width: 54, height: 68, borderRadius: 8 },
  placeholder: { alignItems: "center", justifyContent: "center" },
  cardHeading: { flex: 1 },
  vintage: { fontSize: 21, fontFamily: "Inter_700Bold" },
  winery: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  bestBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 14 },
  bestText: { color: "#FFF", fontSize: 10, fontFamily: "Inter_700Bold" },
  metrics: { flexDirection: "row", gap: 8 },
  metric: { flex: 1, borderRadius: 9, paddingVertical: 9, paddingHorizontal: 5, alignItems: "center" },
  metricValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  metricLabel: { fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 2 },
  details: { borderTopWidth: 1, paddingTop: 11, gap: 6 },
  detailText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  notes: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular" },
  notesEmpty: { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic" },
});
