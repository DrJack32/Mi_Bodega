import { BlurView } from "expo-blur";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Alert, Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useWines } from "@/contexts/WineContext";
import { useColors } from "@/hooks/useColors";

export default function TabLayout() {
  const colors = useColors();
  const router = useRouter();
  const { backupReminderDue, snoozeBackupReminder } = useWines();
  const reminderShown = useRef(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";

  useEffect(() => {
    if (!backupReminderDue || reminderShown.current) return;
    reminderShown.current = true;
    Alert.alert(
      "Toca hacer una copia",
      "Tu bodega ha cambiado o ha pasado el intervalo elegido. Crea un ZIP para mantener también tus fotografías a salvo.",
      [
        {
          text: "Recordar en 3 días",
          style: "cancel",
          onPress: () => void snoozeBackupReminder(),
        },
        {
          text: "Ir a Datos",
          onPress: () => {
            void snoozeBackupReminder();
            router.push("/(tabs)/data");
          },
        },
      ],
    );
  }, [backupReminderDue, router, snoozeBackupReminder]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: Platform.OS === "web" ? 84 : undefined,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Bodega",
          tabBarIcon: ({ color }) => (
            <Ionicons name="wine" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: "Favoritos",
          tabBarIcon: ({ color }) => (
            <Ionicons name="heart" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Estadísticas",
          tabBarIcon: ({ color }) => (
            <Ionicons name="bar-chart" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="data"
        options={{
          title: "Datos",
          tabBarIcon: ({ color }) => (
            <Ionicons name="save" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
