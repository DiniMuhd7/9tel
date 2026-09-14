import React from "react";
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "../../constants/theme";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return <Text style={{ fontSize: 11, color: focused ? colors.primary : colors.inkMuted }}>{label}</Text>;
}

export default function TabsLayout() {
  return (
    // Screens under (tabs) build their own SafeAreaView + header (see index.tsx),
    // so the native tab header stays off to avoid a duplicate header stacking
    // on top of it.
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.inkMuted }}>
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ focused }) => <TabIcon label="🏠" focused={focused} /> }}
      />
      <Tabs.Screen
        name="calls"
        options={{ title: "Calls", tabBarIcon: ({ focused }) => <TabIcon label="📞" focused={focused} /> }}
      />
      <Tabs.Screen
        name="premium"
        options={{ title: "Premium", tabBarIcon: ({ focused }) => <TabIcon label="⭐" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ focused }) => <TabIcon label="👤" focused={focused} /> }}
      />
    </Tabs>
  );
}
