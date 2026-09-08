import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  type BackupPreview,
  type RestoreMode,
  useWines,
} from "@/contexts/WineContext";
import { useColors } from "@/hooks/useColors";

function formatBackupDate(value: string | null) {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : date.toLocaleString("es-ES");
}

export default function DatosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { wines, storageWarning, createBackup, inspectBackup, restoreBackup } =
    useWines();
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [busyAction, setBusyAction] = useState<
    "export" | "inspect" | "restore" | null
  >(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const isBusy = busyAction !== null;

  const exportData = async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Disponible en el movil",
        "La copia completa con fotografias se crea desde la aplicacion instalada.",
      );
      return;
    }

    try {
      setBusyAction("export");
      const result = await createBackup();
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error(
          "Este dispositivo no ofrece una aplicacion para guardar o compartir el archivo.",
        );
      }
      await Sharing.shareAsync(result.uri, {
        dialogTitle: "Guardar copia completa de Mi Bodega",
        mimeType: "application/zip",
        UTI: "public.zip-archive",
      });
      Alert.alert(
        "Copia preparada",
        `${result.wineCount} ${result.wineCount === 1 ? "vino" : "vinos"} y ${result.photoCount} ${result.photoCount === 1 ? "foto" : "fotos"} incluidos. Guarda el ZIP en una ubicacion segura.`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo crear la copia de seguridad.";
      Alert.alert("No se pudo crear la copia", message);
    } finally {
      setBusyAction(null);
    }
  };

  const chooseBackup = async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Disponible en el movil",
        "La restauracion completa se realiza desde la aplicacion instalada.",
      );
      return;
    }

    try {
      setBusyAction("inspect");
      setPreview(null);
      const selection = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (selection.canceled) return;
      const asset = selection.assets[0];
      setPreview(await inspectBackup(asset.uri, asset.name));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo leer el archivo seleccionado.";
      Alert.alert("Copia no valida", message);
    } finally {
      setBusyAction(null);
    }
  };

  const runRestore = async (mode: RestoreMode) => {
    if (!preview) return;
    try {
      setBusyAction("restore");
      const result = await restoreBackup(preview, mode);
      setPreview(null);
      const details = [
        `${result.restoredWineCount} ${result.restoredWineCount === 1 ? "vino restaurado" : "vinos restaurados"}`,
        `${result.restoredPhotoCount} ${result.restoredPhotoCount === 1 ? "foto restaurada" : "fotos restauradas"}`,
      ];
      if (result.skippedWineCount > 0)
        details.push(`${result.skippedWineCount} duplicados omitidos`);
      if (result.missingPhotoCount > 0)
        details.push(
          `${result.missingPhotoCount} fotos antiguas no disponibles`,
        );
      Alert.alert("Restauracion completada", details.join("\n"));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo completar la restauracion.";
      Alert.alert(
        "No se pudo restaurar",
        `${message}\n\nLos datos actuales no se han sustituido.`,
      );
    } finally {
      setBusyAction(null);
    }
  };

  const confirmReplace = () => {
    if (!preview) return;
    Alert.alert(
      "Sustituir datos actuales",
      `Se reemplazaran los ${wines.length} vinos actuales por los ${preview.wineCount} de la copia.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sustituir",
          style: "destructive",
          onPress: () => runRestore("replace"),
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.primary }]}>
          Datos
        </Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          {wines.length}{" "}
          {wines.length === 1 ? "vino guardado" : "vinos guardados"}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomPad + 100 },
        ]}
      >
        {storageWarning && (
          <View
            style={[
              styles.warning,
              { borderColor: colors.destructive, borderRadius: colors.radius },
            ]}
          >
            <Ionicons
              name="warning-outline"
              size={21}
              color={colors.destructive}
            />
            <Text style={[styles.warningText, { color: colors.foreground }]}>
              {storageWarning}
            </Text>
          </View>
        )}

        <View
          style={[
            styles.panel,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <View style={styles.panelHeader}>
            <Ionicons name="archive-outline" size={22} color={colors.primary} />
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>
              Copia de seguridad completa
            </Text>
          </View>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            Crea un archivo ZIP local con todos los vinos y sus fotografias. La
            copia no se sube a ningun servidor.
          </Text>
          <Pressable
            onPress={exportData}
            disabled={isBusy}
            style={[
              styles.primaryButton,
              {
                backgroundColor: colors.primary,
                borderRadius: colors.radius / 1.5,
                opacity: isBusy ? 0.55 : 1,
              },
            ]}
          >
            {busyAction === "export" ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="download" size={18} color="#FFF" />
            )}
            <Text style={styles.primaryButtonText}>
              Crear y guardar copia ZIP
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.panel,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <View style={styles.panelHeader}>
            <Ionicons
              name="folder-open-outline"
              size={22}
              color={colors.primary}
            />
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>
              Restaurar desde archivo
            </Text>
          </View>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            Admite las nuevas copias ZIP y las copias JSON antiguas. Primero se
            revisa el archivo; despues eliges si fusionar o sustituir.
          </Text>
          <Pressable
            onPress={chooseBackup}
            disabled={isBusy}
            style={[
              styles.secondaryButton,
              {
                borderColor: colors.primary,
                borderRadius: colors.radius / 1.5,
                opacity: isBusy ? 0.55 : 1,
              },
            ]}
          >
            {busyAction === "inspect" ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons
                name="document-attach-outline"
                size={18}
                color={colors.primary}
              />
            )}
            <Text
              style={[styles.secondaryButtonText, { color: colors.primary }]}
            >
              Seleccionar copia
            </Text>
          </Pressable>

          {preview && (
            <View
              style={[
                styles.preview,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderRadius: colors.radius / 1.5,
                },
              ]}
            >
              <Text
                style={[styles.previewTitle, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {preview.name}
              </Text>
              <Text
                style={[styles.previewLine, { color: colors.mutedForeground }]}
              >
                {formatBackupDate(preview.exportedAt)}
              </Text>
              <Text
                style={[styles.previewLine, { color: colors.mutedForeground }]}
              >
                {preview.wineCount} vinos · {preview.photoCount} fotos
                {preview.duplicateCount > 0
                  ? ` · ${preview.duplicateCount} ya existentes`
                  : ""}
              </Text>
              {preview.legacy && (
                <Text
                  style={[styles.legacyNote, { color: colors.destructive }]}
                >
                  Copia antigua: solo se recuperaran las fotos que aun sean
                  accesibles en este dispositivo.
                </Text>
              )}
              <View style={styles.restoreActions}>
                <Pressable
                  onPress={() => runRestore("merge")}
                  disabled={isBusy}
                  style={[
                    styles.restoreButton,
                    {
                      backgroundColor: colors.primary,
                      borderRadius: colors.radius / 1.5,
                    },
                  ]}
                >
                  <Text style={styles.restoreButtonText}>Fusionar</Text>
                </Pressable>
                <Pressable
                  onPress={confirmReplace}
                  disabled={isBusy}
                  style={[
                    styles.restoreButton,
                    styles.replaceButton,
                    {
                      borderColor: colors.destructive,
                      borderRadius: colors.radius / 1.5,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.restoreButtonText,
                      { color: colors.destructive },
                    ]}
                  >
                    Sustituir
                  </Text>
                </Pressable>
              </View>
              {busyAction === "restore" && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold" },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  content: { padding: 16, gap: 14 },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    padding: 13,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_500Medium",
  },
  panel: { borderWidth: 1, padding: 16, gap: 14 },
  panelHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  panelTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold" },
  description: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular" },
  primaryButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  secondaryButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  secondaryButtonText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  preview: { borderWidth: 1, padding: 13, gap: 7 },
  previewTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  previewLine: { fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular" },
  legacyNote: { fontSize: 12, lineHeight: 17, fontFamily: "Inter_500Medium" },
  restoreActions: { flexDirection: "row", gap: 10, marginTop: 6 },
  restoreButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  replaceButton: { backgroundColor: "transparent", borderWidth: 1 },
  restoreButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});
