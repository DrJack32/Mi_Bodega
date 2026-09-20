import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useWines } from "@/contexts/WineContext";
import { useColors } from "@/hooks/useColors";

export default function MoveStockScreen() {
  const { wineId, stockEntryId } = useLocalSearchParams<{
    wineId: string;
    stockEntryId: string;
  }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getWine, moveStock, storageLocations } = useWines();
  const wine = getWine(wineId ?? "");
  const stockEntry = wine?.stock.find((entry) => entry.id === stockEntryId);
  const [destination, setDestination] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);
  const topPad = Platform.OS === "web" ? 44 : insets.top;
  const destinations = useMemo(
    () =>
      storageLocations.filter(
        (item) =>
          item.trim().toLocaleLowerCase("es") !==
          stockEntry?.location.trim().toLocaleLowerCase("es"),
      ),
    [stockEntry?.location, storageLocations],
  );

  const save = async () => {
    if (!wine || !stockEntry) return;
    const parsedQuantity = Number.parseInt(quantity, 10);
    if (!destination.trim()) {
      Alert.alert("Falta el destino", "Indica la nueva ubicación.");
      return;
    }
    if (
      !Number.isSafeInteger(parsedQuantity) ||
      parsedQuantity < 1 ||
      parsedQuantity > stockEntry.quantity
    ) {
      Alert.alert(
        "Cantidad no válida",
        `Puedes mover entre 1 y ${stockEntry.quantity} botellas.`,
      );
      return;
    }
    try {
      setSaving(true);
      await moveStock(
        wine.id,
        stockEntry.id,
        destination.trim(),
        parsedQuantity,
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      Alert.alert(
        "No se pudo mover",
        error instanceof Error
          ? error.message
          : "Las botellas no se han movido.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!wine || !stockEntry || stockEntry.quantity < 1) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>
          Este lote ya no está disponible.
        </Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={{ color: colors.primary }}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  const parsedQuantity = Number.parseInt(quantity, 10);
  const safeQuantity = Number.isFinite(parsedQuantity) ? parsedQuantity : 1;
  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      color: colors.foreground,
      borderRadius: colors.radius / 1.5,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 10, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="close" size={23} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Mover botellas
          </Text>
          <Text
            style={[styles.subtitle, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {wine.name || wine.winery} {wine.vintage ? `· ${wine.vintage}` : ""}
          </Text>
        </View>
        <Pressable
          onPress={save}
          disabled={saving}
          style={[
            styles.saveButton,
            { backgroundColor: colors.primary, opacity: saving ? 0.5 : 1 },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.saveText}>Mover</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.originCard,
            { backgroundColor: colors.secondary, borderRadius: colors.radius },
          ]}
        >
          <Ionicons name="archive-outline" size={22} color={colors.primary} />
          <View style={styles.originText}>
            <Text
              style={[styles.originLabel, { color: colors.mutedForeground }]}
            >
              Origen
            </Text>
            <Text style={[styles.originValue, { color: colors.foreground }]}>
              {stockEntry.location || "Sin ubicación"} · {stockEntry.quantity}{" "}
              {stockEntry.quantity === 1 ? "botella" : "botellas"}
            </Text>
          </View>
        </View>

        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Nueva ubicación
        </Text>
        <TextInput
          style={inputStyle}
          value={destination}
          onChangeText={setDestination}
          placeholder="Botellero principal, nevera de vinos..."
          placeholderTextColor={colors.mutedForeground}
        />
        {destinations.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {destinations.map((item) => (
              <Pressable
                key={item}
                onPress={() => setDestination(item)}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      destination === item ? colors.primary : colors.secondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: destination === item ? "#FFF" : colors.foreground,
                    },
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Botellas a mover
        </Text>
        <View
          style={[
            styles.quantityRow,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius / 1.5,
            },
          ]}
        >
          <Pressable
            onPress={() => setQuantity(String(Math.max(1, safeQuantity - 1)))}
            style={styles.quantityButton}
          >
            <Ionicons name="remove" size={22} color={colors.primary} />
          </Pressable>
          <TextInput
            style={[styles.quantityInput, { color: colors.foreground }]}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            selectTextOnFocus
          />
          <Pressable
            onPress={() =>
              setQuantity(
                String(Math.min(stockEntry.quantity, safeQuantity + 1)),
              )
            }
            style={styles.quantityButton}
          >
            <Ionicons name="add" size={22} color={colors.primary} />
          </Pressable>
        </View>
        <Pressable
          onPress={() => setQuantity(String(stockEntry.quantity))}
          style={styles.moveAllButton}
        >
          <Text style={[styles.moveAllText, { color: colors.primary }]}>
            Mover todas ({stockEntry.quantity})
          </Text>
        </Pressable>
        <Text style={[styles.help, { color: colors.mutedForeground }]}>
          El traslado no contará como una compra nueva y quedará incluido en tus
          copias de seguridad.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  backLink: { padding: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  title: { fontSize: 16, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  saveButton: {
    minWidth: 72,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  saveText: { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 13 },
  content: { padding: 16, gap: 11, paddingBottom: 48 },
  originCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 14,
    marginBottom: 4,
  },
  originText: { flex: 1 },
  originLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
  },
  originValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 4 },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  chips: { gap: 8, paddingBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  quantityRow: {
    minHeight: 50,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  quantityButton: {
    width: 52,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityInput: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  moveAllButton: { alignSelf: "flex-end", paddingVertical: 4 },
  moveAllText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  help: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
});
