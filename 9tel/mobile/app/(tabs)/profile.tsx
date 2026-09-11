import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{user?.name ?? "—"}</Text>
      <Text style={styles.detail}>{user?.email ?? "—"}</Text>
      <Text style={styles.detail}>{user?.phone ?? "—"}</Text>
      <Text style={styles.detail}>{user?.country ?? "—"}</Text>
      <Text style={styles.tier}>Plan: {user?.subscriptionTier ?? "free"}</Text>

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 40 },
  name: { fontSize: 22, fontWeight: "800", color: "#111827" },
  detail: { fontSize: 14, color: "#4b5563", marginTop: 6 },
  tier: { fontSize: 14, color: "#111827", fontWeight: "700", marginTop: 16, textTransform: "capitalize" },
  signOutButton: { marginTop: 40, borderWidth: 1, borderColor: "#ef4444", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  signOutText: { color: "#ef4444", fontWeight: "700" },
});
