import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PhotoViewer } from "@/components/PhotoViewer";
import { FramedWinePhoto } from "@/components/FramedWinePhoto";
import { useColors } from "@/hooks/useColors";
import { useWines } from "@/contexts/WineContext";
import {
  getWineAverageRating,
  getWineStockCount,
  getWineTastedBottleCount,
  getWineVintageFamily,
} from "@/lib/wineData";

const TYPE_LABELS: Record<string, string> = {
  tinto: "Tinto",
  blanco: "Blanco",
  rosado: "Rosado",
  espumoso: "Espumoso",
  generoso: "Generoso",
  dulce: "Dulce",
  orange: "Orange",
  otro: "Otro",
};
const TYPE_COLORS: Record<string, string> = {
  tinto: "#7B2D3E",
  blanco: "#C4974A",
  rosado: "#D4788A",
  espumoso: "#5B8C9E",
  generoso: "#8B6914",
  dulce: "#9B4FAB",
  orange: "#C86E2A",
  otro: "#6B7280",
};

function InfoRow({ label, value }: { label: string; value?: string }) {
  const colors = useColors();
  if (!value) return null;
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  const colors = useColors();
  return (
    <View style={[styles.sectionTitle, { borderLeftColor: colors.primary }]}>
      <Text style={[styles.sectionTitleText, { color: colors.primary }]}>
        {title}
      </Text>
    </View>
  );
}

export default function WineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: photoWidth } = useWindowDimensions();
  const { wines, getWine, toggleFavorite, deleteWine } = useWines();
  const wine = getWine(id ?? "");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const photoScroll = useRef<ScrollView>(null);

  useEffect(() => {
    setPhotoIndex(0);
    photoScroll.current?.scrollTo({ x: 0, animated: false });
  }, [id, wine?.photos.length]);

  const goToPhoto = (index: number) => {
    if (!wine || index < 0 || index >= wine.photos.length) return;
    setPhotoIndex(index);
    photoScroll.current?.scrollTo({ x: index * photoWidth, animated: true });
  };

  if (!wine) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFoundText, { color: colors.foreground }]}>
          Vino no encontrado
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>
            Volver
          </Text>
        </Pressable>
      </View>
    );
  }

  const typeColor = TYPE_COLORS[wine.type] ?? colors.primary;
  const stockCount = getWineStockCount(wine);
  const tastedCount = getWineTastedBottleCount(wine);
  const averageRating = getWineAverageRating(wine);
  const vintageFamily = getWineVintageFamily(wines, wine);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleDelete = () => {
    Alert.alert(
      "Eliminar vino",
      `¿Estás seguro de que quieres eliminar "${wine.name || wine.winery}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteWine(wine.id);
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              );
              router.back();
            } catch (error) {
              const message =
                error instanceof Error
                  ? error.message
                  : "No se pudo eliminar el vino.";
              Alert.alert(
                "No se pudo eliminar",
                `${message}\n\nEl vino se ha conservado.`,
              );
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.photoArea}>
          {wine.photos.length > 0 ? (
            <>
              <ScrollView
                ref={photoScroll}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                scrollEnabled={wine.photos.length > 1}
                onScroll={(event) => {
                  const index = Math.round(
                    event.nativeEvent.contentOffset.x / photoWidth,
                  );
                  if (
                    index !== photoIndex &&
                    index >= 0 &&
                    index < wine.photos.length
                  )
                    setPhotoIndex(index);
                }}
                scrollEventThrottle={32}
                accessibilityLabel="Fotografías del vino. Desliza para ver las demás"
              >
                {wine.photos.map((uri, index) => (
                  <Pressable
                    key={`${index}-${uri}`}
                    style={[styles.heroPhoto, { width: photoWidth }]}
                    onPress={() => {
                      setPhotoIndex(index);
                      setViewerOpen(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Ampliar fotografía ${index + 1}`}
                  >
                    <FramedWinePhoto
                      uri={uri}
                      framing={{
                        zoom: index === 0 ? wine.coverZoom : 1,
                        offsetX: index === 0 ? wine.coverOffsetX : 0,
                        offsetY: index === 0 ? wine.coverOffsetY : 0,
                      }}
                      style={StyleSheet.absoluteFill}
                    />
                  </Pressable>
                ))}
              </ScrollView>
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.7)"]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              {wine.photos.length > 1 && (
                <View style={styles.photoControls} pointerEvents="box-none">
                  <Pressable
                    onPress={() => goToPhoto(photoIndex - 1)}
                    disabled={photoIndex === 0}
                    accessibilityRole="button"
                    accessibilityLabel="Foto anterior"
                    style={[
                      styles.photoArrow,
                      photoIndex === 0 && styles.photoArrowDisabled,
                    ]}
                  >
                    <Ionicons name="chevron-back" size={24} color="#FFF" />
                  </Pressable>
                  <Text style={styles.photoCount}>
                    {photoIndex + 1} / {wine.photos.length}
                  </Text>
                  <Pressable
                    onPress={() => goToPhoto(photoIndex + 1)}
                    disabled={photoIndex === wine.photos.length - 1}
                    accessibilityRole="button"
                    accessibilityLabel="Foto siguiente"
                    style={[
                      styles.photoArrow,
                      photoIndex === wine.photos.length - 1 &&
                        styles.photoArrowDisabled,
                    ]}
                  >
                    <Ionicons name="chevron-forward" size={24} color="#FFF" />
                  </Pressable>
                </View>
              )}
              <View style={styles.expandHint} pointerEvents="none">
                <Ionicons name="expand-outline" size={15} color="#FFF" />
                <Text style={styles.expandHintText}>Toca para ampliar</Text>
              </View>
            </>
          ) : (
            <View
              style={[styles.photoPlaceholder, { backgroundColor: typeColor }]}
            >
              <Ionicons name="wine" size={80} color="rgba(255,255,255,0.3)" />
            </View>
          )}

          <View style={[styles.heroOverlay, { paddingTop: topPad + 8 }]}>
            <Pressable
              onPress={() => router.back()}
              style={[styles.circleBtn, { backgroundColor: "rgba(0,0,0,0.4)" }]}
            >
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </Pressable>
            <View style={styles.heroActions}>
              <Pressable
                onPress={async () => {
                  try {
                    await toggleFavorite(wine.id);
                    await Haptics.impactAsync(
                      Haptics.ImpactFeedbackStyle.Light,
                    );
                  } catch (error) {
                    const message =
                      error instanceof Error
                        ? error.message
                        : "No se pudo guardar el cambio.";
                    Alert.alert("No se pudo actualizar", message);
                  }
                }}
                style={[
                  styles.circleBtn,
                  { backgroundColor: "rgba(0,0,0,0.4)" },
                ]}
              >
                <Ionicons
                  name={wine.isFavorite ? "heart" : "heart-outline"}
                  size={22}
                  color={wine.isFavorite ? "#FF6B6B" : "#FFF"}
                />
              </Pressable>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/add-wine",
                    params: { editId: wine.id },
                  })
                }
                style={[
                  styles.circleBtn,
                  { backgroundColor: "rgba(0,0,0,0.4)" },
                ]}
              >
                <Ionicons name="pencil" size={20} color="#FFF" />
              </Pressable>
              <Pressable
                onPress={handleDelete}
                style={[
                  styles.circleBtn,
                  { backgroundColor: "rgba(0,0,0,0.4)" },
                ]}
              >
                <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
              </Pressable>
            </View>
          </View>

          <View style={styles.heroBottom}>
            <View style={[styles.typePill, { backgroundColor: typeColor }]}>
              <Text style={styles.typePillText}>
                {TYPE_LABELS[wine.type] ?? "Otro"}
              </Text>
            </View>
            {averageRating > 0 && (
              <View
                style={[
                  styles.ratingPill,
                  { backgroundColor: "rgba(0,0,0,0.6)" },
                ]}
              >
                <Ionicons name="star" size={14} color="#F1C40F" />
                <Text style={styles.ratingPillText}>
                  {averageRating.toFixed(1)}/10
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.mainInfo}>
          <Text style={[styles.wineName, { color: colors.foreground }]}>
            {wine.name || "Sin nombre"}
          </Text>
          {wine.winery ? (
            <Text style={[styles.winery, { color: colors.primary }]}>
              {wine.winery}
            </Text>
          ) : null}

          <View style={styles.tagsRow}>
            {wine.vintage ? (
              <View style={[styles.tag, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.tagText, { color: colors.foreground }]}>
                  {wine.vintage}
                </Text>
              </View>
            ) : null}
            {wine.country ? (
              <View style={[styles.tag, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.tagText, { color: colors.foreground }]}>
                  {wine.country}
                </Text>
              </View>
            ) : null}
            {wine.denomination ? (
              <View style={[styles.tag, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.tagText, { color: colors.foreground }]}>
                  {wine.denomination}
                </Text>
              </View>
            ) : null}
          </View>

          {wine.wouldRepeat !== null && (
            <View
              style={[
                styles.repeatBadge,
                {
                  backgroundColor: wine.wouldRepeat
                    ? "rgba(39,174,96,0.12)"
                    : "rgba(192,57,43,0.12)",
                  borderRadius: colors.radius / 2,
                },
              ]}
            >
              <Ionicons
                name={wine.wouldRepeat ? "checkmark-circle" : "close-circle"}
                size={16}
                color={wine.wouldRepeat ? "#27AE60" : "#C0392B"}
              />
              <Text
                style={[
                  styles.repeatText,
                  { color: wine.wouldRepeat ? "#27AE60" : "#C0392B" },
                ]}
              >
                {wine.wouldRepeat ? "¡Lo repetiría!" : "No lo repetiría"}
              </Text>
            </View>
          )}

          <View style={styles.summaryRow}>
            <View
              style={[
                styles.summaryPill,
                { backgroundColor: colors.secondary },
              ]}
            >
              <Ionicons
                name="archive-outline"
                size={16}
                color={colors.primary}
              />
              <Text style={[styles.summaryText, { color: colors.foreground }]}>
                {stockCount} {stockCount === 1 ? "en bodega" : "en bodega"}
              </Text>
            </View>
            <View
              style={[
                styles.summaryPill,
                { backgroundColor: colors.secondary },
              ]}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color={colors.primary}
              />
              <Text style={[styles.summaryText, { color: colors.foreground }]}>
                {tastedCount} {tastedCount === 1 ? "bebida" : "bebidas"}
              </Text>
            </View>
          </View>

          <View style={styles.primaryActions}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/add-tasting",
                  params: { wineId: wine.id },
                })
              }
              style={[
                styles.actionPrimary,
                {
                  backgroundColor: colors.primary,
                  borderRadius: colors.radius / 1.5,
                },
              ]}
            >
              <Ionicons name="wine-outline" size={19} color="#FFF" />
              <Text style={styles.actionPrimaryText}>
                Registrar botella bebida
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/add-stock",
                  params: { wineId: wine.id },
                })
              }
              style={[
                styles.actionSecondary,
                {
                  borderColor: colors.primary,
                  borderRadius: colors.radius / 1.5,
                },
              ]}
            >
              <Ionicons
                name="add-circle-outline"
                size={19}
                color={colors.primary}
              />
              <Text
                style={[styles.actionSecondaryText, { color: colors.primary }]}
              >
                Añadir a bodega
              </Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/add-wine",
                params: { cloneId: wine.id },
              })
            }
            style={styles.vintageAction}
          >
            <Ionicons
              name="duplicate-outline"
              size={17}
              color={colors.primary}
            />
            <Text style={[styles.vintageActionText, { color: colors.primary }]}>
              Añadir otra añada de este vino
            </Text>
          </Pressable>
          {vintageFamily.length > 1 && (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/compare-vintages",
                  params: { id: wine.id },
                })
              }
              style={styles.vintageAction}
            >
              <Ionicons
                name="git-compare-outline"
                size={17}
                color={colors.primary}
              />
              <Text
                style={[styles.vintageActionText, { color: colors.primary }]}
              >
                Comparar las {vintageFamily.length} añadas
              </Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.contentPad, { paddingBottom: bottomPad + 24 }]}>
          {(wine.region ||
            wine.denomination ||
            wine.grapes ||
            wine.agingCategory ||
            wine.agingMonths ||
            wine.alcohol ||
            wine.volume ||
            wine.barcode ||
            wine.dataSource) && (
            <>
              <SectionTitle title="Datos del vino" />
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <InfoRow label="Región" value={wine.region} />
                <InfoRow label="Denominación" value={wine.denomination} />
                <InfoRow label="Variedades" value={wine.grapes} />
                <InfoRow label="Crianza" value={wine.agingCategory} />
                <InfoRow
                  label="Tiempo de crianza"
                  value={wine.agingMonths ? `${wine.agingMonths} meses` : ""}
                />
                <InfoRow label="Graduación" value={wine.alcohol} />
                <InfoRow label="Volumen" value={wine.volume} />
                <InfoRow label="Código de barras" value={wine.barcode} />
                <InfoRow label="Fuente de datos" value={wine.dataSource} />
              </View>
            </>
          )}

          {stockCount > 0 && (
            <>
              <SectionTitle title="Botellas en mi bodega" />
              <View style={styles.historyList}>
                {wine.stock
                  .filter((entry) => entry.quantity > 0)
                  .map((entry) => (
                    <View
                      key={entry.id}
                      style={[
                        styles.stockCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          borderRadius: colors.radius,
                        },
                      ]}
                    >
                      <View style={styles.stockInfo}>
                        <Text
                          style={[
                            styles.stockLocation,
                            { color: colors.foreground },
                          ]}
                        >
                          {entry.location || "Sin ubicación"}
                        </Text>
                        <Text
                          style={[
                            styles.stockMeta,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          {entry.quantity}{" "}
                          {entry.quantity === 1 ? "botella" : "botellas"}
                          {entry.price ? ` · ${entry.price} € / botella` : ""}
                        </Text>
                      </View>
                      <View style={styles.stockActions}>
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: "/add-tasting",
                              params: {
                                wineId: wine.id,
                                stockEntryId: entry.id,
                              },
                            })
                          }
                          style={[
                            styles.stockButton,
                            { backgroundColor: colors.primary },
                          ]}
                        >
                          <Ionicons name="wine" size={15} color="#FFF" />
                          <Text style={styles.drinkButtonText}>Beber</Text>
                        </Pressable>
                        <Pressable
                          onPress={() =>
                            router.push({
                              pathname: "/move-stock",
                              params: {
                                wineId: wine.id,
                                stockEntryId: entry.id,
                              },
                            })
                          }
                          style={[
                            styles.stockButton,
                            { borderColor: colors.primary, borderWidth: 1 },
                          ]}
                        >
                          <Ionicons
                            name="swap-horizontal"
                            size={15}
                            color={colors.primary}
                          />
                          <Text
                            style={[
                              styles.moveButtonText,
                              { color: colors.primary },
                            ]}
                          >
                            Mover
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
              </View>
            </>
          )}

          {wine.stockMovements.length > 0 && (
            <>
              <SectionTitle title="Movimientos de bodega" />
              <View style={styles.historyList}>
                {wine.stockMovements.slice(0, 10).map((movement) => (
                  <View
                    key={movement.id}
                    style={[
                      styles.movementCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderRadius: colors.radius,
                      },
                    ]}
                  >
                    <Ionicons
                      name="swap-horizontal"
                      size={18}
                      color={colors.primary}
                    />
                    <View style={styles.movementInfo}>
                      <Text
                        style={[
                          styles.movementRoute,
                          { color: colors.foreground },
                        ]}
                      >
                        {movement.fromLocation || "Sin ubicación"} →{" "}
                        {movement.toLocation}
                      </Text>
                      <Text
                        style={[
                          styles.stockMeta,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {movement.quantity}{" "}
                        {movement.quantity === 1 ? "botella" : "botellas"} ·{" "}
                        {new Intl.DateTimeFormat("es-ES", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        }).format(new Date(movement.movedAt))}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {wine.tastings.length > 0 ? (
            <>
              <SectionTitle title="Historial de botellas bebidas" />
              <View style={styles.historyList}>
                {wine.tastings.map((tasting, index) => (
                  <View
                    key={tasting.id}
                    style={[
                      styles.tastingCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderRadius: colors.radius,
                      },
                    ]}
                  >
                    <View style={styles.tastingHeader}>
                      <View
                        style={[
                          styles.tastingNumber,
                          { backgroundColor: colors.secondary },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tastingNumberText,
                            { color: colors.primary },
                          ]}
                        >
                          #{wine.tastings.length - index}
                        </Text>
                      </View>
                      <View style={styles.tastingHeading}>
                        <Text
                          style={[
                            styles.tastingDate,
                            { color: colors.foreground },
                          ]}
                        >
                          {tasting.date || "Fecha sin indicar"}
                        </Text>
                        <Text
                          style={[
                            styles.tastingMeta,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          {tasting.quantity}{" "}
                          {tasting.quantity === 1 ? "botella" : "botellas"}
                          {tasting.location ? ` · ${tasting.location}` : ""}
                          {tasting.price ? ` · ${tasting.price} €` : ""}
                        </Text>
                      </View>
                      {tasting.rating > 0 && (
                        <View
                          style={[
                            styles.tastingRating,
                            { backgroundColor: colors.primary },
                          ]}
                        >
                          <Text style={styles.tastingRatingText}>
                            {tasting.rating}
                          </Text>
                        </View>
                      )}
                    </View>
                    {tasting.notes ? (
                      <Text
                        style={[
                          styles.tastingNotes,
                          { color: colors.foreground },
                        ]}
                      >
                        {tasting.notes}
                      </Text>
                    ) : null}
                    {tasting.wouldRepeat !== null && (
                      <Text
                        style={[
                          styles.tastingRepeat,
                          {
                            color: tasting.wouldRepeat ? "#27AE60" : "#C0392B",
                          },
                        ]}
                      >
                        {tasting.wouldRepeat
                          ? "Lo repetiría"
                          : "No lo repetiría"}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View
              style={[
                styles.emptyHistory,
                {
                  backgroundColor: colors.secondary,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Ionicons
                name="hourglass-outline"
                size={24}
                color={colors.primary}
              />
              <Text
                style={[styles.emptyHistoryText, { color: colors.foreground }]}
              >
                Aún no has registrado ninguna botella bebida de esta añada.
              </Text>
            </View>
          )}

          {wine.ocrUsed && (
            <View
              style={[
                styles.ocrBanner,
                {
                  backgroundColor: colors.muted,
                  borderRadius: colors.radius / 2,
                },
              ]}
            >
              <Ionicons
                name="sparkles"
                size={14}
                color={colors.mutedForeground}
              />
              <Text style={[styles.ocrText, { color: colors.mutedForeground }]}>
                Algunos datos extraídos por OCR
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
      <PhotoViewer
        visible={viewerOpen}
        photos={wine.photos}
        index={photoIndex}
        onIndexChange={setPhotoIndex}
        onClose={() => setViewerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  notFoundText: { fontSize: 18, fontFamily: "Inter_500Medium" },
  backText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  photoArea: { height: 320, position: "relative" },
  heroPhoto: { height: 320 },
  photoPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  photoControls: {
    position: "absolute",
    bottom: 56,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  photoArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoArrowDisabled: { opacity: 0.3 },
  photoCount: {
    color: "#FFF",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: "hidden",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  expandHint: {
    position: "absolute",
    right: 14,
    bottom: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 15,
  },
  expandHintText: {
    color: "#FFF",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  heroOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  heroActions: { flexDirection: "row", gap: 8 },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBottom: {
    position: "absolute",
    bottom: 16,
    left: 16,
    flexDirection: "row",
    gap: 8,
  },
  typePill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  typePillText: {
    color: "#FFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  ratingPillText: { color: "#FFF", fontSize: 13, fontFamily: "Inter_700Bold" },
  mainInfo: { padding: 20, gap: 8 },
  wineName: { fontSize: 24, fontFamily: "Inter_700Bold", lineHeight: 30 },
  winery: { fontSize: 16, fontFamily: "Inter_500Medium" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  tagText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  repeatBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  repeatText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  summaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 18,
  },
  summaryText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  primaryActions: { flexDirection: "row", gap: 9, marginTop: 8 },
  actionPrimary: {
    flex: 1.2,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 10,
  },
  actionPrimaryText: {
    color: "#FFF",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  actionSecondary: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  actionSecondaryText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  vintageAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 8,
  },
  vintageActionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  contentPad: { paddingHorizontal: 16, gap: 12 },
  sectionTitle: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  sectionTitleText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  card: { borderWidth: 1, overflow: "hidden" },
  infoRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    gap: 12,
  },
  infoLabel: { width: 110, fontSize: 13, fontFamily: "Inter_400Regular" },
  infoValue: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  notesCard: { borderWidth: 1, padding: 16 },
  notesText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  historyList: { gap: 9 },
  stockCard: {
    borderWidth: 1,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stockInfo: { flex: 1 },
  stockLocation: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  stockMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  stockActions: { gap: 7 },
  stockButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 12,
    borderRadius: 19,
  },
  drinkButtonText: { color: "#FFF", fontSize: 12, fontFamily: "Inter_700Bold" },
  moveButtonText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  movementCard: {
    borderWidth: 1,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  movementInfo: { flex: 1 },
  movementRoute: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tastingCard: { borderWidth: 1, padding: 14, gap: 9 },
  tastingHeader: { flexDirection: "row", alignItems: "center", gap: 9 },
  tastingNumber: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 14 },
  tastingNumberText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  tastingHeading: { flex: 1 },
  tastingDate: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tastingMeta: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  tastingRating: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tastingRatingText: {
    color: "#FFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  tastingNotes: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  tastingRepeat: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  emptyHistory: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  emptyHistoryText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  ocrBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ocrText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
