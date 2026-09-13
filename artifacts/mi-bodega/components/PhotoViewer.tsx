import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect } from "react";
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

type PhotoViewerProps = {
  visible: boolean;
  photos: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onUseAsCover?: (index: number) => void;
  coverIndex?: number;
};

export function PhotoViewer({
  visible,
  photos,
  index,
  onIndexChange,
  onClose,
  onUseAsCover,
  coverIndex = 0,
}: PhotoViewerProps) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const resetZoom = () => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedX.value = 0;
    savedY.value = 0;
  };

  useEffect(() => {
    resetZoom();
  }, [index, visible]);

  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.max(1, Math.min(5, savedScale.value * event.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.02) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > 1) {
        translateX.value = savedX.value + event.translationX;
        translateY.value = savedY.value + event.translationY;
      }
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const changePhoto = (next: number) => {
    if (next < 0 || next >= photos.length) return;
    onIndexChange(next);
  };

  const changeZoom = (delta: number) => {
    const next = Math.max(1, Math.min(5, scale.value + delta));
    scale.value = withTiming(next);
    savedScale.value = next;
    if (next === 1) {
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedX.value = 0;
      savedY.value = 0;
    }
  };

  if (photos.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.container}>
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.imageArea, animatedStyle]}>
            <Image
              source={{ uri: photos[index] }}
              style={styles.image}
              contentFit="contain"
              transition={120}
            />
          </Animated.View>
        </GestureDetector>

        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <Text style={styles.counter}>{index + 1} / {photos.length}</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cerrar fotografía"
            style={styles.circleButton}
          >
            <Ionicons name="close" size={26} color="#FFF" />
          </Pressable>
        </View>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
          <Pressable
            onPress={() => changePhoto(index - 1)}
            disabled={index === 0}
            style={[styles.circleButton, index === 0 && styles.disabled]}
          >
            <Ionicons name="chevron-back" size={26} color="#FFF" />
          </Pressable>
          <View style={styles.zoomControls}>
            <Pressable onPress={() => changeZoom(-0.5)} style={styles.zoomButton}>
              <Ionicons name="remove" size={22} color="#FFF" />
            </Pressable>
            {onUseAsCover ? (
              <Pressable
                onPress={() => onUseAsCover(index)}
                style={[styles.coverButton, index === coverIndex && styles.coverButtonActive]}
              >
                <Ionicons name={index === coverIndex ? "star" : "star-outline"} size={15} color="#FFF" />
                <Text style={styles.coverButtonText}>{index === coverIndex ? "Encuadrar" : "Usar de portada"}</Text>
              </Pressable>
            ) : (
              <Text style={styles.hint}>Pellizca o toca dos veces</Text>
            )}
            <Pressable onPress={() => changeZoom(0.5)} style={styles.zoomButton}>
              <Ionicons name="add" size={22} color="#FFF" />
            </Pressable>
          </View>
          <Pressable
            onPress={() => changePhoto(index + 1)}
            disabled={index === photos.length - 1}
            style={[
              styles.circleButton,
              index === photos.length - 1 && styles.disabled,
            ]}
          >
            <Ionicons name="chevron-forward" size={26} color="#FFF" />
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050505" },
  imageArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  counter: { color: "#FFF", fontSize: 15, fontFamily: "Inter_700Bold" },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.25 },
  zoomControls: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, justifyContent: "center" },
  zoomButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  coverButton: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.16)" },
  coverButtonActive: { backgroundColor: "rgba(151,45,72,0.9)" },
  coverButtonText: { color: "#FFF", fontSize: 11, fontFamily: "Inter_700Bold" },
  hint: { color: "#FFF", fontSize: 11, fontFamily: "Inter_500Medium" },
});
