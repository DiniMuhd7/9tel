import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>9tel</Text>
      <Text style={styles.tagline}>One number. Any phone.</Text>

      <View style={styles.buttons}>
        <Pressable style={styles.primaryButton} onPress={() => router.push("/(auth)/register")}>
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.push("/(auth)/login")}>
          <Text style={styles.secondaryButtonText}>Log In</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center", padding: 24 },
  logo: { fontSize: 42, fontWeight: "800", color: "#fff" },
  tagline: { fontSize: 15, color: "#94a3b8", marginTop: 8, marginBottom: 48 },
  buttons: { width: "100%", gap: 12 },
  primaryButton: { backgroundColor: "#22c55e", borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  primaryButtonText: { color: "#0f172a", fontWeight: "800", fontSize: 15 },
  secondaryButton: { borderRadius: 12, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "#334155" },
  secondaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
