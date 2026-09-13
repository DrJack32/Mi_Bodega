import { Image } from "expo-image";
import React, { useState } from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";

export type CoverFraming = {
  zoom: number;
  offsetX: number;
  offsetY: number;
};

type FramedWinePhotoProps = {
  uri: string;
  framing: CoverFraming;
  style?: StyleProp<ViewStyle>;
};

export function FramedWinePhoto({ uri, framing, style }: FramedWinePhotoProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
  };

  return (
    <View style={[styles.frame, style]} onLayout={onLayout}>
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [
              { translateX: framing.offsetX * size.width },
              { translateY: framing.offsetY * size.height },
              { scale: framing.zoom },
            ],
          },
        ]}
      >
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden", backgroundColor: "#0C0C0C" },
});
