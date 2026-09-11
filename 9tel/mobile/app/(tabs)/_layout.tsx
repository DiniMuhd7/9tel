import React from "react";
import { Tabs } from "expo-router";
import { Text } from "react-native";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return <Text style={{ fontSize: 11, color: focused ? "#111827" : "#9ca3af" }}>{label}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
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
