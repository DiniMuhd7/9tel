import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { BrandMark } from "../../components/BrandMark";
import { colors, radius } from "../../constants/theme";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

/**
 * Used for two different situations, distinguished by the `intent` param:
 *
 *  - `intent=upgrade` (from the Premium screen's Upgrade button): the
 *    caller already has a Free-tier guest session. Verifying here LINKS
 *    the phone to that same account (passing the guest token to
 *    verifyOtp) rather than creating a new one, so the guest's existing
 *    number/extension/call history carries over. Continues to
 *    complete-profile, then back to checkout.
 *  - No `intent` (reached via Profile tab's "Log in to a Premium
 *    account" link): a plain login/restore — no guest token is sent, so
 *    the backend just finds-or-creates by phone directly. This is for
 *    restoring an EXISTING Premium account on a new device; it does not
 *    preserve whatever guest session was active before.
 */
export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ intent?: string; planId?: string }>();
  const { token, signIn } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isUpgrade = params.intent === "upgrade";

  const handleRequestOtp = async () => {
    if (!phone.trim()) return Alert.alert("Enter your phone number", "Use the number you want to receive calls on.");
    setSubmitting(true);
    try {
      await api.auth.requestOtp(phone.trim());
      setOtpSent(true);
    } catch {
      Alert.alert("Couldn't send code", "Check the number and try again.");
    } finally { setSubmitting(false); }
  };

  const handleVerify = async () => {
    if (code.trim().length < 6) return Alert.alert("Enter the 6-digit code", "Check the code we sent and try again.");
    setSubmitting(true);
    try {
      // Only pass the existing token when linking a phone to the current
      // guest session (upgrade flow) — a plain login/restore should not
      // send it, so the backend does a normal phone lookup instead.
      const { token: newToken, user } = await api.auth.verifyOtp(
        phone.trim(),
        code.trim(),
        isUpgrade ? token ?? undefined : undefined
      );
      await signIn(newToken, user);

      const nextParams = isUpgrade && params.planId ? `?intent=upgrade&planId=${params.planId}` : "";
      router.replace(user.profileComplete ? "/(tabs)" : `/(auth)/complete-profile${nextParams}`);
    } catch (err: any) {
      const message = err?.message?.includes("already registered")
        ? "That number is already linked to a different account."
        : "Please try again.";
      Alert.alert("Invalid code", message);
    } finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.container}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()}><Text style={styles.back}>‹  Back</Text></Pressable>
          <View style={styles.brand}><BrandMark /><Text style={styles.brandName}>9tel</Text></View>
          <View style={styles.copy}>
            <Text style={styles.title}>{otpSent ? "Check your messages" : isUpgrade ? "Verify your number" : "Log in"}</Text>
            <Text style={styles.description}>
              {otpSent
                ? `We sent a 6-digit code to ${phone}.`
                : isUpgrade
                  ? "Premium needs a verified number for billing and support."
                  : "Enter the number linked to your Premium account."}
            </Text>
          </View>
          <View style={styles.form}>
            {!otpSent && <><Text style={styles.label}>PHONE NUMBER</Text><TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+1 555 000 0000" placeholderTextColor="#8AA0B9" keyboardType="phone-pad" autoComplete="tel" /></>}
            {otpSent && <><Text style={styles.label}>VERIFICATION CODE</Text><TextInput style={[styles.input, styles.codeInput]} value={code} onChangeText={setCode} placeholder="000000" placeholderTextColor="#8AA0B9" keyboardType="number-pad" maxLength={6} autoFocus /></>}
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.button, (pressed || submitting) && styles.buttonPressed]} onPress={otpSent ? handleVerify : handleRequestOtp} disabled={submitting}><Text style={styles.buttonText}>{submitting ? "Please wait…" : otpSent ? "Verify" : "Send verification code"}</Text><Text style={styles.buttonArrow}>→</Text></Pressable>
            {otpSent && <Pressable onPress={() => setOtpSent(false)}><Text style={styles.changeNumber}>Use a different number</Text></Pressable>}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas }, flex: { flex: 1 }, container: { flex: 1, padding: 24 },
  back: { color: colors.inkMuted, fontSize: 15, fontWeight: "700" }, brand: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 34 }, brandName: { color: colors.ink, fontSize: 21, fontWeight: "800" },
  copy: { marginTop: 32 }, title: { color: colors.ink, fontSize: 30, lineHeight: 36, letterSpacing: -0.8, fontWeight: "800" }, description: { color: colors.inkMuted, fontSize: 15, lineHeight: 22, marginTop: 9 },
  form: { marginTop: 32 }, label: { color: colors.inkMuted, fontSize: 11, letterSpacing: 1, fontWeight: "800", marginBottom: 9 }, input: { minHeight: 56, borderRadius: radius.small, backgroundColor: colors.surface, paddingHorizontal: 16, color: colors.ink, fontSize: 16, borderWidth: 1, borderColor: colors.border }, codeInput: { letterSpacing: 8, fontSize: 20, fontWeight: "700", textAlign: "center" },
  button: { minHeight: 56, marginTop: 20, borderRadius: radius.medium, backgroundColor: colors.primary, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, buttonPressed: { backgroundColor: colors.primaryPressed, opacity: 0.9 }, buttonText: { color: colors.white, fontSize: 16, fontWeight: "800" }, buttonArrow: { color: colors.white, fontSize: 25 }, changeNumber: { textAlign: "center", color: colors.primary, fontSize: 14, fontWeight: "700", marginTop: 18 },
});
