import { Ionicons } from "@expo/vector-icons";
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useWines } from "@/contexts/WineContext";
import { useColors } from "@/hooks/useColors";
import { callOCR } from "@/lib/ocr";
import { LOOKUP_FIELD_KEYS, type LookupFieldKey, type WineLookupResult, lookupFromLocalWine, lookupWineByBarcode, normalizeBarcode } from "@/lib/wineLookup";

const FIELD_LABELS: Record<LookupFieldKey, string> = {
  name: "Nombre", winery: "Bodega", type: "Tipo", country: "País", region: "Región",
  denomination: "Denominación de origen", grapes: "Variedades", agingCategory: "Tipo de crianza",
  agingMonths: "Tiempo de crianza", alcohol: "Graduación", volume: "Formato",
};

const TYPE_LABELS: Record<string, string> = {
  tinto: "Tinto", blanco: "Blanco", rosado: "Rosado", espumoso: "Espumoso",
  generoso: "Generoso", dulce: "Dulce", orange: "Orange", otro: "Otro",
};

export default function ScanScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { wines } = useWines();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<"menu" | "barcode">("menu");
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [result, setResult] = useState<WineLookupResult | null>(null);
  const [selected, setSelected] = useState<Partial<Record<LookupFieldKey, boolean>>>({});
  const lookupLock = useRef(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const processImage = async (uri: string, barcode = "") => {
    setIsProcessing(true);
    setStatus("Analizando etiqueta...");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const fields = await callOCR(uri);
      const hasData = Object.keys(fields).length > 0;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!hasData) Alert.alert("Poco texto detectado", "No he podido reconocer datos claros de la etiqueta. Aun así puedes guardar la foto y completar el vino manualmente.");
      router.replace({
        pathname: "/add-wine",
        params: {
          ocrData: JSON.stringify(fields),
          photoUri: uri,
          ...(barcode ? { lookupData: JSON.stringify({ barcode }) } : {}),
        },
      });
    } catch (error) {
      setIsProcessing(false);
      setStatus("");
      const message = error instanceof Error ? error.message : "Prueba con otra foto más clara.";
      Alert.alert("Error", `No se pudo procesar la imagen.\n\n${message}`);
    }
  };

  const pickFromCamera = async (barcode = "") => {
    try {
      const image = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9, allowsEditing: false, exif: false });
      if (!image.canceled && image.assets[0]) await processImage(image.assets[0].uri, barcode);
    } catch { Alert.alert("Error", "No se pudo acceder a la cámara."); }
  };

  const pickFromGallery = async (barcode = "") => {
    try {
      const image = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, allowsEditing: false, exif: false });
      if (!image.canceled && image.assets[0]) await processImage(image.assets[0].uri, barcode);
    } catch { Alert.alert("Error", "No se pudo acceder a la galería."); }
  };

  const openBarcodeScanner = async () => {
    setMode("barcode");
    setResult(null);
    if (!permission?.granted) await requestPermission();
  };

  const chooseLabelPhoto = (barcode: string) => {
    Alert.alert("Leer la etiqueta", "Elige cómo añadir la fotografía que analizará el lector local.", [
      { text: "Cámara", onPress: () => void pickFromCamera(barcode) },
      { text: "Galería", onPress: () => void pickFromGallery(barcode) },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const useBarcode = async (rawBarcode: string) => {
    if (lookupLock.current || result) return;
    let barcode: string;
    try { barcode = normalizeBarcode(rawBarcode); }
    catch (error) {
      Alert.alert("Código no válido", error instanceof Error ? error.message : "Revisa el código.");
      return;
    }

    lookupLock.current = true;
    setIsProcessing(true);
    setStatus("Buscando el vino...");
    try {
      const localWine = wines.find((wine) => wine.barcode === barcode);
      const found = localWine ? lookupFromLocalWine(localWine, barcode) : await lookupWineByBarcode(barcode);
      if (!found) {
        setIsProcessing(false);
        setStatus("");
        setManualBarcode(barcode);
        const unlockScanner = () => { lookupLock.current = false; };
        Alert.alert(
          "Vino no encontrado",
          `Código leído: ${barcode}\n\nNo figura en ninguna de las dos bases consultadas. Podemos conservar el código y leer ahora la etiqueta.`,
          [
            { text: "Leer etiqueta", onPress: () => { unlockScanner(); chooseLabelPhoto(barcode); } },
            { text: "Crear ficha", onPress: () => router.replace({ pathname: "/add-wine", params: { lookupData: JSON.stringify({ barcode }) } }) },
            { text: "Cancelar", style: "cancel", onPress: unlockScanner },
          ],
          { cancelable: true, onDismiss: unlockScanner },
        );
        return;
      }
      setResult(found);
      setManualBarcode(barcode);
      setSelected(Object.fromEntries(LOOKUP_FIELD_KEYS.filter((key) => Boolean(found.fields[key])).map((key) => [key, true])));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      lookupLock.current = false;
      Alert.alert("No se pudo consultar", error instanceof Error ? error.message : "Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      setIsProcessing(false);
      setStatus("");
    }
  };

  const continueWithResult = () => {
    if (!result) return;
    const fields = Object.fromEntries(LOOKUP_FIELD_KEYS.filter((key) => selected[key] && result.fields[key] !== undefined).map((key) => [key, result.fields[key]]));
    router.replace({
      pathname: "/add-wine",
      params: { lookupData: JSON.stringify({ ...fields, barcode: result.barcode, dataSource: result.source, dataSourceUrl: result.sourceUrl, dataFetchedAt: result.fetchedAt }) },
    });
  };

  const resetScanner = () => { lookupLock.current = false; setResult(null); setManualBarcode(""); setSelected({}); };
  const goBack = () => {
    if (mode === "barcode") { setMode("menu"); resetScanner(); }
    else router.back();
  };

  if (isProcessing && mode === "menu") {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <View style={[styles.loadingCard, { backgroundColor: colors.card, borderRadius: colors.radius * 2 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingTitle, { color: colors.foreground }]}>{status}</Text>
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Leyendo la etiqueta en el dispositivo...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={goBack} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color={colors.foreground} /></Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{mode === "barcode" ? "Buscar por código" : "Añadir vino"}</Text>
        <View style={styles.backBtn} />
      </View>

      {mode === "menu" ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}>
          <View style={[styles.infoBox, { backgroundColor: colors.secondary, borderRadius: colors.radius }]}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.foreground }]}>Empieza por el código de barras para recuperar datos conocidos. Después podrás añadir fotos y completar la información de la etiqueta.</Text>
          </View>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ELIGE UNA OPCIÓN</Text>
          <OptionCard colors={colors} icon="barcode-outline" color={colors.primary} title="Escanear código de barras" description="Busca en tu colección y en dos bases de productos" onPress={openBarcodeScanner} />
          <OptionCard colors={colors} icon="camera" color="#7B2D3E" title="Fotografiar la etiqueta" description="Extrae en el móvil los datos escritos en la etiqueta" onPress={() => void pickFromCamera()} />
          <OptionCard colors={colors} icon="images" color={colors.accent} title="Elegir de la galería" description="Analiza una foto existente de tu galería" onPress={() => void pickFromGallery()} />
          <Pressable onPress={() => router.replace("/add-wine")} style={({ pressed }) => [styles.skipBtn, { borderColor: colors.border, borderRadius: colors.radius }, pressed && { opacity: 0.7 }]}><Text style={[styles.skipText, { color: colors.mutedForeground }]}>Introducir manualmente</Text></Pressable>
          <View style={[styles.disclaimerBox, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
            <Ionicons name="shield-checkmark-outline" size={17} color={colors.mutedForeground} />
            <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>Las fotos y tu colección permanecen en el móvil. A Open Food Facts y UPCitemdb solo se envía el número del código de barras.</Text>
          </View>
        </ScrollView>
      ) : result ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}>
          <View style={[styles.resultHeader, { backgroundColor: colors.secondary, borderRadius: colors.radius }]}>
            <Ionicons name={result.source === "Mi Bodega" ? "phone-portrait-outline" : "globe-outline"} size={23} color={colors.primary} />
            <View style={styles.optionInfo}><Text style={[styles.resultTitle, { color: colors.foreground }]}>Datos encontrados</Text><Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>Fuente: {result.source} · EAN {result.barcode}</Text></View>
          </View>
          {result.localWineId && <View style={[styles.infoBox, { backgroundColor: colors.muted, borderRadius: colors.radius }]}><Ionicons name="albums-outline" size={20} color={colors.primary} /><Text style={[styles.infoText, { color: colors.foreground }]}>Ya tienes una ficha con este código. Puedes abrirla o crear otra para una añada diferente.</Text></View>}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MARCA LOS DATOS QUE QUIERES COPIAR</Text>
          {LOOKUP_FIELD_KEYS.filter((key) => result.fields[key] !== undefined && result.fields[key] !== "").map((key) => {
            const value = key === "type" ? TYPE_LABELS[String(result.fields[key])] : String(result.fields[key]);
            return <Pressable key={key} onPress={() => setSelected((current) => ({ ...current, [key]: !current[key] }))} style={[styles.fieldCard, { backgroundColor: colors.card, borderColor: selected[key] ? colors.primary : colors.border, borderRadius: colors.radius }]}>
              <Ionicons name={selected[key] ? "checkbox" : "square-outline"} size={24} color={selected[key] ? colors.primary : colors.mutedForeground} />
              <View style={styles.optionInfo}><Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{FIELD_LABELS[key]}</Text><Text style={[styles.fieldValue, { color: colors.foreground }]}>{value}</Text></View>
            </Pressable>;
          })}
          <View style={[styles.warningBox, { borderColor: colors.border, borderRadius: colors.radius }]}><Ionicons name="alert-circle-outline" size={19} color={colors.accent} /><Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>La base de datos puede estar incompleta. No copiamos la añada automáticamente: compruébala en esta botella.</Text></View>
          {result.localWineId && <Pressable onPress={() => router.replace(`/wine/${result.localWineId}`)} style={[styles.secondaryButton, { borderColor: colors.primary, borderRadius: colors.radius }]}><Text style={[styles.buttonText, { color: colors.primary }]}>Abrir ficha existente</Text></Pressable>}
          <Pressable onPress={continueWithResult} style={[styles.primaryButton, { backgroundColor: colors.primary, borderRadius: colors.radius }]}><Text style={styles.primaryButtonText}>{result.localWineId ? "Crear otra añada" : "Usar datos seleccionados"}</Text></Pressable>
          <Pressable onPress={resetScanner} style={styles.linkButton}><Text style={[styles.buttonText, { color: colors.mutedForeground }]}>Escanear otro código</Text></Pressable>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.scannerContent, { paddingBottom: bottomPad + 24 }]} keyboardShouldPersistTaps="handled">
          {permission?.granted ? (
            <View style={[styles.cameraFrame, { borderRadius: colors.radius * 1.5 }]}>
              <CameraView style={StyleSheet.absoluteFill} facing="back" enableTorch={torchEnabled} barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "itf14"] }} onBarcodeScanned={isProcessing ? undefined : ({ data }: BarcodeScanningResult) => void useBarcode(data)} />
              <View pointerEvents="none" style={styles.scanGuide} />
              {isProcessing && <View style={styles.cameraLoading}><ActivityIndicator size="large" color="#FFF" /><Text style={styles.cameraLoadingText}>{status}</Text></View>}
            </View>
          ) : (
            <View style={[styles.permissionCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Ionicons name="camera-outline" size={38} color={colors.primary} /><Text style={[styles.resultTitle, { color: colors.foreground }]}>Permiso de cámara</Text>
              <Text style={[styles.infoText, { color: colors.mutedForeground, textAlign: "center" }]}>Activa la cámara para leer el código o introdúcelo manualmente debajo.</Text>
              <Pressable onPress={requestPermission} style={[styles.primaryButton, { backgroundColor: colors.primary, borderRadius: colors.radius }]}><Text style={styles.primaryButtonText}>Permitir cámara</Text></Pressable>
            </View>
          )}
          {permission?.granted && <Pressable onPress={() => setTorchEnabled((value) => !value)} style={[styles.secondaryButton, { borderColor: colors.border, borderRadius: colors.radius }]}><Ionicons name={torchEnabled ? "flash" : "flash-outline"} size={18} color={colors.foreground} /><Text style={[styles.buttonText, { color: colors.foreground }]}>{torchEnabled ? "Apagar luz" : "Encender luz"}</Text></Pressable>}
          <Text style={[styles.scannerHelp, { color: colors.mutedForeground }]}>Centra el código dentro del recuadro. La búsqueda se inicia automáticamente.</Text>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>O ESCRÍBELO</Text>
          <View style={styles.manualRow}>
            <TextInput style={[styles.barcodeInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]} value={manualBarcode} onChangeText={(value) => setManualBarcode(value.replace(/\D/g, ""))} placeholder="EAN / UPC" placeholderTextColor={colors.mutedForeground} keyboardType="number-pad" maxLength={14} editable={!isProcessing} />
            <Pressable disabled={isProcessing || manualBarcode.length < 8} onPress={() => void useBarcode(manualBarcode)} style={[styles.searchButton, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: isProcessing || manualBarcode.length < 8 ? 0.45 : 1 }]}><Ionicons name="search" size={22} color="#FFF" /></Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function OptionCard({ colors, icon, color, title, description, onPress }: { colors: ReturnType<typeof useColors>; icon: React.ComponentProps<typeof Ionicons>["name"]; color: string; title: string; description: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.optionCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius * 1.5 }, pressed && { opacity: 0.85 }]}>
    <View style={[styles.optionIcon, { backgroundColor: color }]}><Ionicons name={icon} size={28} color="#FFF" /></View>
    <View style={styles.optionInfo}><Text style={[styles.optionTitle, { color: colors.foreground }]}>{title}</Text><Text style={[styles.optionDesc, { color: colors.mutedForeground }]}>{description}</Text></View>
    <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
  </Pressable>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, loading: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingCard: { padding: 40, alignItems: "center", gap: 16, width: "100%", maxWidth: 320 }, loadingTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { width: 40, alignItems: "flex-start" }, headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  content: { padding: 20, gap: 16 }, scannerContent: { padding: 20, gap: 14 },
  infoBox: { flexDirection: "row", padding: 14, gap: 10, alignItems: "flex-start" }, infoText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginTop: 8 },
  optionCard: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  optionIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" }, optionInfo: { flex: 1 },
  optionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 2 }, optionDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  skipBtn: { borderWidth: 1, padding: 14, alignItems: "center", marginTop: 4 }, skipText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  disclaimerBox: { flexDirection: "row", padding: 12, gap: 8, alignItems: "flex-start" }, disclaimerText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }, resultTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  fieldCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderWidth: 1.5 }, fieldLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 2 },
  fieldValue: { fontSize: 15, fontFamily: "Inter_500Medium" }, warningBox: { flexDirection: "row", padding: 12, gap: 8, alignItems: "flex-start", borderWidth: 1 },
  primaryButton: { minHeight: 50, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }, primaryButtonText: { color: "#FFF", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  secondaryButton: { minHeight: 48, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, borderWidth: 1 }, buttonText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  linkButton: { minHeight: 42, alignItems: "center", justifyContent: "center" }, cameraFrame: { height: 330, overflow: "hidden", backgroundColor: "#000" },
  scanGuide: { position: "absolute", left: 30, right: 30, top: 95, height: 140, borderWidth: 3, borderRadius: 14, borderColor: "#FFF" },
  cameraLoading: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "rgba(0,0,0,0.58)" }, cameraLoadingText: { color: "#FFF", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  scannerHelp: { fontSize: 13, lineHeight: 18, textAlign: "center", fontFamily: "Inter_400Regular" }, permissionCard: { padding: 24, alignItems: "center", gap: 13, borderWidth: 1 },
  manualRow: { flexDirection: "row", gap: 10 }, barcodeInput: { flex: 1, minHeight: 50, borderWidth: 1, paddingHorizontal: 15, fontSize: 16, fontFamily: "Inter_500Medium", letterSpacing: 1 },
  searchButton: { width: 54, minHeight: 50, alignItems: "center", justifyContent: "center" },
});
