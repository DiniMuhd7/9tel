import React from "react";
import { SafeAreaView, StyleSheet, Text, View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { BrandMark } from "../../components/BrandMark";
import { colors, radius } from "../../constants/theme";

/**
 * No longer the app's default first screen — app/index.tsx now bootstraps
 * a Free-tier guest session automatically and drops straight into
 * (tabs). This screen is reached only when explicitly navigated to (e.g.
 * Profile tab's "Log in to a Premium account" link, or the Premium
 * upgrade flow), for restoring an existing account on a new device.
 */
export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.brandRow}>
          <BrandMark inverse />
          <Text style={styles.brandName}>9tel</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.phoneCard}>
            <View style={styles.phoneTop}><View style={styles.speaker} /></View>
            <View style={styles.phoneBody}>
              <Text style={styles.phoneGreeting}>Good morning, Ada</Text>
              <Text style={styles.phoneNumber}>+234 800 9TEL</Text>
              <View style={styles.forwardingRow}>
                <Text style={styles.forwardingDot}>●</Text>
                <Text style={styles.forwardingText}>Forwarding calls securely</Text>
              </View>
            </View>
          </View>
          <View style={styles.orbitOne} />
          <View style={styles.orbitTwo} />
        </View>

        <View style={styles.copy}>
          <Text style={styles.eyebrow}>YOUR NUMBER, EVERYWHERE</Text>
          <Text style={styles.title}>Stay reachable on{`\n`}your terms.</Text>
          <Text style={styles.description}>Get a dedicated number and send calls to the phone you already use.</Text>
        </View>

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.primaryButtonText}>Create your number</Text>
            <Text style={styles.arrow}>→</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.secondaryButtonText}>I already have an account</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.ink },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 20 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandName: { color: colors.white, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  hero: { height: 225, alignItems: "center", justifyContent: "center", position: "relative" },
  phoneCard: { width: 206, height: 156, borderRadius: radius.large, backgroundColor: colors.white, overflow: "hidden", zIndex: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.24, shadowRadius: 26, elevation: 10 },
  phoneTop: { height: 26, alignItems: "center", justifyContent: "center", backgroundColor: "#F2F6FC" },
  speaker: { width: 39, height: 4, borderRadius: radius.pill, backgroundColor: "#C6D3E2" },
  phoneBody: { padding: 18 },
  phoneGreeting: { color: colors.inkMuted, fontSize: 11, fontWeight: "600" },
  phoneNumber: { color: colors.ink, fontSize: 19, fontWeight: "800", letterSpacing: -0.5, marginTop: 8 },
  forwardingRow: { marginTop: 19, paddingTop: 11, borderTopWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 6 },
  forwardingDot: { color: "#26AA76", fontSize: 10 },
  forwardingText: { color: colors.inkMuted, fontSize: 10, fontWeight: "600" },
  orbitOne: { position: "absolute", width: 255, height: 255, borderRadius: 200, borderWidth: 1, borderColor: "rgba(139, 192, 255, 0.16)" },
  orbitTwo: { position: "absolute", width: 330, height: 330, borderRadius: 200, borderWidth: 1, borderColor: "rgba(139, 192, 255, 0.08)" },
  copy: { marginTop: 3 },
  eyebrow: { color: "#8DDBBE", fontSize: 11, letterSpacing: 1.2, fontWeight: "800" },
  title: { color: colors.white, fontSize: 34, lineHeight: 40, letterSpacing: -1.25, fontWeight: "800", marginTop: 13 },
  description: { color: "#B7C6DA", fontSize: 16, lineHeight: 23, marginTop: 14, maxWidth: 330 },
  actions: { marginTop: "auto", gap: 10 },
  primaryButton: { minHeight: 56, borderRadius: radius.medium, backgroundColor: colors.primary, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pressed: { backgroundColor: colors.primaryPressed },
  primaryButtonText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  arrow: { color: colors.white, fontSize: 25, fontWeight: "500" },
  secondaryButton: { minHeight: 49, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: "#D1DEED", fontSize: 14, fontWeight: "700" },
});
