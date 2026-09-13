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

function todayText() {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

export default function AddTastingScreen() {
  const { wineId, stockEntryId } = useLocalSearchParams<{
    wineId: string;
    stockEntryId?: string;
  }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getWine, addTasting, wines } = useWines();
  const wine = getWine(wineId ?? "");
  const stockEntry = wine?.stock.find((entry) => entry.id === stockEntryId);
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState(stockEntry?.price ?? "");
  const [rating, setRating] = useState(0);
  const [wouldRepeat, setWouldRepeat] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [saving, setSaving] = useState(false);

  const tastingLocations = useMemo(
    () =>
      [
        ...new Set(
          wines
            .flatMap((item) => item.tastings.map((t) => t.location.trim()))
            .filter(Boolean),
        ),
      ].slice(0, 12),
    [wines],
  );
  const topPad = Platform.OS === "web" ? 44 : insets.top;
  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      color: colors.foreground,
      borderRadius: colors.radius / 1.5,
    },
  ];

  const save = async () => {
    if (!wine) return;
    const parsedQuantity = Number.parseInt(quantity, 10);
    if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity < 1) {
      Alert.alert("Cantidad no valida", "Indica al menos una botella.");
      return;
    }
    if (stockEntry && parsedQuantity > stockEntry.quantity) {
      Alert.alert(
        "No hay suficientes botellas",
        `En ${stockEntry.location} quedan ${stockEntry.quantity}.`,
      );
      return;
    }
    try {
      setSaving(true);
      await addTasting(
        wine.id,
        {
          date: date.trim(),
          location: location.trim(),
          price: price.trim(),
          rating,
          wouldRepeat,
          notes: notes.trim(),
          quantity: parsedQuantity,
          fromStock: Boolean(stockEntry),
        },
        stockEntry?.id,
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      Alert.alert(
        "No se pudo guardar",
        error instanceof Error ? error.message : "La cata no se ha guardado.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!wine) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>Vino no encontrado</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: colors.primary }}>Volver</Text>
        </Pressable>
      </View>
    );
  }

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
            Registrar botella bebida
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
            <Text style={styles.saveText}>Guardar</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {stockEntry && (
          <View
            style={[
              styles.stockNotice,
              {
                backgroundColor: colors.secondary,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Ionicons name="archive-outline" size={20} color={colors.primary} />
            <Text
              style={[styles.stockNoticeText, { color: colors.foreground }]}
            >
              Se descontará de {stockEntry.location}. Quedan{" "}
              {stockEntry.quantity}.
            </Text>
          </View>
        )}

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Fecha
            </Text>
            <TextInput
              style={inputStyle}
              value={date}
              onChangeText={setDate}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numbers-and-punctuation"
            />
            <Pressable
              onPress={() => setDate(todayText())}
              style={styles.todayButton}
            >
              <Text style={[styles.todayText, { color: colors.primary }]}>
                Usar hoy
              </Text>
            </Pressable>
          </View>
          <View style={styles.half}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Botellas
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
                onPress={() =>
                  setQuantity(String(Math.max(1, (Number(quantity) || 1) - 1)))
                }
                style={styles.quantityButton}
              >
                <Ionicons name="remove" size={20} color={colors.primary} />
              </Pressable>
              <TextInput
                style={[styles.quantityInput, { color: colors.foreground }]}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="number-pad"
              />
              <Pressable
                onPress={() => setQuantity(String((Number(quantity) || 0) + 1))}
                style={styles.quantityButton}
              >
                <Ionicons name="add" size={20} color={colors.primary} />
              </Pressable>
            </View>
          </View>
        </View>

        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Lugar
        </Text>
        <TextInput
          style={inputStyle}
          value={location}
          onChangeText={setLocation}
          placeholder="Casa, restaurante, viaje..."
          placeholderTextColor={colors.mutedForeground}
        />
        {tastingLocations.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {tastingLocations.map((item) => (
              <Pressable
                key={item}
                onPress={() => setLocation(item)}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      location === item ? colors.primary : colors.secondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: location === item ? "#FFF" : colors.foreground },
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Precio por botella (€) · opcional
        </Text>
        <TextInput
          style={inputStyle}
          value={price}
          onChangeText={setPrice}
          placeholder="12,50"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="decimal-pad"
        />

        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Puntuación
        </Text>
        <View style={styles.ratings}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
            <Pressable
              key={value}
              onPress={() => setRating(rating === value ? 0 : value)}
              style={[
                styles.rating,
                {
                  backgroundColor:
                    rating >= value ? colors.primary : colors.secondary,
                },
              ]}
            >
              <Text
                style={{
                  color: rating >= value ? "#FFF" : colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {value}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.repeatRow, { borderColor: colors.border }]}>
          <Text style={[styles.repeatLabel, { color: colors.foreground }]}>
            ¿Lo repetirías?
          </Text>
          <View style={styles.repeatButtons}>
            <Pressable
              onPress={() => setWouldRepeat(wouldRepeat === true ? null : true)}
              style={[
                styles.repeatButton,
                {
                  backgroundColor:
                    wouldRepeat === true ? "#27AE60" : colors.secondary,
                },
              ]}
            >
              <Text
                style={{
                  color: wouldRepeat === true ? "#FFF" : colors.foreground,
                }}
              >
                Sí
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                setWouldRepeat(wouldRepeat === false ? null : false)
              }
              style={[
                styles.repeatButton,
                {
                  backgroundColor:
                    wouldRepeat === false
                      ? colors.destructive
                      : colors.secondary,
                },
              ]}
            >
              <Text
                style={{
                  color: wouldRepeat === false ? "#FFF" : colors.foreground,
                }}
              >
                No
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Notas de esta cata · opcional
        </Text>
        <TextInput
          style={[inputStyle, styles.notes]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Aromas, sabores, maridaje, impresiones..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          textAlignVertical="top"
        />
        <Text style={[styles.help, { color: colors.mutedForeground }]}>
          La fecha queda abierta: puedes registrar hoy una botella que bebiste
          otro día.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
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
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  stockNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 13,
    marginBottom: 4,
  },
  stockNoticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_500Medium",
  },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 4 },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  notes: { minHeight: 110 },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  todayButton: { alignSelf: "flex-start", paddingVertical: 5 },
  todayText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  quantityRow: {
    minHeight: 46,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  quantityButton: {
    width: 38,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityInput: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  chips: { gap: 8, paddingBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  ratings: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  rating: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  repeatRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 12,
    marginVertical: 4,
  },
  repeatLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  repeatButtons: { flexDirection: "row", gap: 8 },
  repeatButton: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  help: { fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular" },
});
