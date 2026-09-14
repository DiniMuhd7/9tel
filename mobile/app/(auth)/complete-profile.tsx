import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { BrandMark } from "../../components/BrandMark";
import { colors, radius } from "../../constants/theme";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Shown once a phone is linked but the profile is still incomplete —
 * reached either from a plain login/restore, or (with `intent=upgrade`
 * and `planId` params) as the last step before resuming checkout for a
 * Premium purchase. In the upgrade case, submitting continues straight
 * into startCheckout instead of dropping into (tabs), so the person
 * doesn't have to re-tap Upgrade after filling this in.
 */
export default function CompleteProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ intent?: string; planId?: string }>();
  const { token, user, updateUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isUpgrade = params.intent === "upgrade" && !!params.planId;

  const handleContinue = async () => {
    if (!name.trim() || !email.trim() || !country.trim()) {
      return Alert.alert("A few more details", "Fill in your name, email, and country to continue.");
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      return Alert.alert("That email doesn't look right", "Double check it and try again.");
    }
    if (!token) return;
    setSubmitting(true);
    try {
      const { user: updated } = await api.auth.updateProfile(token, {
        name: name.trim(),
        email: email.trim(),
        country: country.trim(),
      });
      await updateUser(updated);

      if (isUpgrade && params.planId) {
        try {
          const { checkoutUrl } = await api.billing.startCheckout(token, params.planId);
          Linking.openURL(checkoutUrl);
        } catch {
          // Checkout isn't wired to a real processor yet (see
          // services/payments/flutterwave.ts) — land back on Premium
          // either way so the person isn't stuck on this screen.
        }
        router.replace("/(tabs)/premium");
        return;
      }

      router.replace("/(tabs)");
    } catch {
      Alert.alert("Couldn't save your details", "That email may already be in use — try another.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.container}>
          <View style={styles.brand}>
            <BrandMark />
            <Text style={styles.brandName}>9tel</Text>
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>You're verified — almost there</Text>
            <Text style={styles.description}>Add a few details to finish setting up {user?.phone ?? "your account"}.</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>NAME</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor="#8AA0B9" autoFocus />

            <Text style={styles.label}>EMAIL</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#8AA0B9" keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.label}>COUNTRY</Text>
            <TextInput style={styles.input} value={country} onChangeText={setCountry} placeholder="United States" placeholderTextColor="#8AA0B9" />

            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.button, (pressed || submitting) && styles.buttonPressed]}
              onPress={handleContinue}
              disabled={submitting}
            >
              <Text style={styles.buttonText}>{submitting ? "Please wait…" : "Continue"}</Text>
              <Text style={styles.buttonArrow}>→</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  container: { flex: 1, padding: 24 },
  brand: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 34 },
  brandName: { color: colors.ink, fontSize: 21, fontWeight: "800" },
  copy: { marginTop: 32 },
  title: { color: colors.ink, fontSize: 28, lineHeight: 34, letterSpacing: -0.7, fontWeight: "800" },
  description: { color: colors.inkMuted, fontSize: 15, lineHeight: 22, marginTop: 9 },
  form: { marginTop: 32 },
  label: { color: colors.inkMuted, fontSize: 11, letterSpacing: 1, fontWeight: "800", marginBottom: 9, marginTop: 18 },
  input: {
    minHeight: 56,
    borderRadius: radius.small,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    color: colors.ink,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    minHeight: 56,
    marginTop: 28,
    borderRadius: radius.medium,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  buttonPressed: { backgroundColor: colors.primaryPressed, opacity: 0.9 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  buttonArrow: { color: colors.white, fontSize: 25 },
});
