import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
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

export default function AddStockScreen() {
  const { wineId } = useLocalSearchParams<{ wineId: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getWine, addStock, storageLocations } = useWines();
  const wine = getWine(wineId ?? "");
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
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
    if (!location.trim()) {
      Alert.alert("Falta la ubicación", "Indica dónde guardarás las botellas.");
      return;
    }
    if (
      !Number.isSafeInteger(parsedQuantity) ||
      parsedQuantity < 1 ||
      parsedQuantity > 10_000
    ) {
      Alert.alert("Cantidad no válida", "Introduce entre 1 y 10.000 botellas.");
      return;
    }
    try {
      setSaving(true);
      await addStock(wine.id, {
        location: location.trim(),
        quantity: parsedQuantity,
        price: price.trim(),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      Alert.alert(
        "No se pudo guardar",
        error instanceof Error
          ? error.message
          : "Las botellas no se han guardado.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!wine) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground }}>Vino no encontrado</Text>
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
            Añadir a la bodega
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
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          Registra una nueva compra o más unidades de esta misma añada.
        </Text>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Ubicación
        </Text>
        <TextInput
          style={inputStyle}
          value={location}
          onChangeText={setLocation}
          placeholder="Botellero principal, nevera de vinos..."
          placeholderTextColor={colors.mutedForeground}
        />
        {storageLocations.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {storageLocations.map((item) => (
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
          Cantidad
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
            onPress={() => setQuantity(String((Number(quantity) || 0) + 1))}
            style={styles.quantityButton}
          >
            <Ionicons name="add" size={22} color={colors.primary} />
          </Pressable>
        </View>
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
        <Text style={[styles.help, { color: colors.mutedForeground }]}>
          La ubicación quedará guardada como opción para futuras botellas.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
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
  intro: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
    marginBottom: 5,
  },
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
  help: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
});
