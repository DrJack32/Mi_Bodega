import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { CoverFraming } from "@/components/FramedWinePhoto";

type CoverEditorProps = {
  visible: boolean;
  uri?: string;
  initial: CoverFraming;
  onSave: (framing: CoverFraming) => void;
  onClose: () => void;
};

export function CoverEditor({ visible, uri, initial, onSave, onClose }: CoverEditorProps) {
  const insets = useSafeAreaInsets();
  const [frame, setFrame] = useState({ width: 1, height: 1 });
  const scale = useSharedValue(initial.zoom);
  const savedScale = useSharedValue(initial.zoom);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  useEffect(() => {
    scale.value = initial.zoom;
    savedScale.value = initial.zoom;
    x.value = initial.offsetX * frame.width;
    y.value = initial.offsetY * frame.height;
    savedX.value = x.value;
    savedY.value = y.value;
  }, [visible, uri, frame.width, frame.height, initial.zoom, initial.offsetX, initial.offsetY]);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.max(1, Math.min(5, savedScale.value * event.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });
  const pan = Gesture.Pan()
    .onUpdate((event) => {
      x.value = savedX.value + event.translationX;
      y.value = savedY.value + event.translationY;
    })
    .onEnd(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    });
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  const reset = () => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    x.value = withTiming(0);
    y.value = withTiming(0);
    savedX.value = 0;
    savedY.value = 0;
  };

  const changeZoom = (delta: number) => {
    const next = Math.max(1, Math.min(5, scale.value + delta));
    scale.value = withTiming(next);
    savedScale.value = next;
  };

  const save = () => {
    onSave({
      zoom: Math.max(1, Math.min(5, scale.value)),
      offsetX: Math.max(-1, Math.min(1, x.value / frame.width)),
      offsetY: Math.max(-1, Math.min(1, y.value / frame.height)),
    });
    onClose();
  };

  if (!uri) return null;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={onClose} style={styles.headerButton}>
            <Text style={styles.cancel}>Cancelar</Text>
          </Pressable>
          <Text style={styles.title}>Encuadrar portada</Text>
          <Pressable onPress={save} style={styles.saveButton}>
            <Text style={styles.saveText}>Guardar</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          <Text style={styles.help}>Mueve y amplía la fotografía hasta que la etiqueta quede dentro del marco.</Text>
          <View
            style={styles.frame}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setFrame({ width, height });
            }}
          >
            <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
              <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
                <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
              </Animated.View>
            </GestureDetector>
            <View style={styles.guide} pointerEvents="none" />
          </View>

          <View style={styles.controls}>
            <Pressable onPress={() => changeZoom(-0.25)} style={styles.controlButton}>
              <Ionicons name="remove" size={24} color="#FFF" />
            </Pressable>
            <Pressable onPress={reset} style={styles.resetButton}>
              <Ionicons name="refresh" size={17} color="#FFF" />
              <Text style={styles.resetText}>Ver foto completa</Text>
            </Pressable>
            <Pressable onPress={() => changeZoom(0.25)} style={styles.controlButton}>
              <Ionicons name="add" size={24} color="#FFF" />
            </Pressable>
          </View>
          <Text style={styles.note}>La fotografía original no se recorta ni se pierde: solo se guarda este encuadre.</Text>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080808" },
  header: { minHeight: 72, paddingHorizontal: 14, paddingBottom: 12, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#333" },
  headerButton: { minWidth: 72, minHeight: 38, justifyContent: "center" },
  cancel: { color: "#DDD", fontSize: 14, fontFamily: "Inter_500Medium" },
  title: { color: "#FFF", fontSize: 17, fontFamily: "Inter_700Bold", paddingBottom: 9 },
  saveButton: { minWidth: 72, minHeight: 38, borderRadius: 10, backgroundColor: "#9D304E", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  saveText: { color: "#FFF", fontSize: 13, fontFamily: "Inter_700Bold" },
  body: { flex: 1, padding: 18, justifyContent: "center", gap: 18 },
  help: { color: "#EEE", fontSize: 13, lineHeight: 19, fontFamily: "Inter_500Medium", textAlign: "center" },
  frame: { width: "100%", aspectRatio: 1.15, overflow: "hidden", backgroundColor: "#151515", borderRadius: 12 },
  guide: { ...StyleSheet.absoluteFillObject, borderWidth: 2, borderColor: "rgba(255,255,255,0.82)", borderRadius: 12 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14 },
  controlButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#333", alignItems: "center", justifyContent: "center" },
  resetButton: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 23, backgroundColor: "#333", paddingHorizontal: 17 },
  resetText: { color: "#FFF", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  note: { color: "#AAA", fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular", textAlign: "center" },
});
