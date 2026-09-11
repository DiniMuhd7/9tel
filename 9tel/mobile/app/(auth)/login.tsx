import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { BrandMark } from "../../components/BrandMark";
import { colors, radius } from "../../constants/theme";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleRequestOtp = async () => {
    if (!phone.trim()) return Alert.alert("Enter your phone number", "Use the number connected to your 9tel account.");
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
      const { token, user } = await api.auth.verifyOtp(phone.trim(), code.trim());
      await signIn(token, user);
      router.replace("/(tabs)");
    } catch {
      Alert.alert("Invalid code", "Please try again.");
    } finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.container}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()}><Text style={styles.back}>‹  Back</Text></Pressable>
          <View style={styles.brand}><BrandMark /><Text style={styles.brandName}>9tel</Text></View>
          <View style={styles.copy}><Text style={styles.title}>{otpSent ? "Check your messages" : "Welcome back"}</Text><Text style={styles.description}>{otpSent ? `We sent a 6-digit code to ${phone}.` : "Enter your number to securely access your calls."}</Text></View>
          <View style={styles.form}>
            {!otpSent && <><Text style={styles.label}>PHONE NUMBER</Text><TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+234 800 000 0000" placeholderTextColor="#8AA0B9" keyboardType="phone-pad" autoComplete="tel" /></>}
            {otpSent && <><Text style={styles.label}>VERIFICATION CODE</Text><TextInput style={[styles.input, styles.codeInput]} value={code} onChangeText={setCode} placeholder="000000" placeholderTextColor="#8AA0B9" keyboardType="number-pad" maxLength={6} autoFocus /></>}
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.button, (pressed || submitting) && styles.buttonPressed]} onPress={otpSent ? handleVerify : handleRequestOtp} disabled={submitting}><Text style={styles.buttonText}>{submitting ? "Please wait…" : otpSent ? "Verify and log in" : "Send verification code"}</Text><Text style={styles.buttonArrow}>→</Text></Pressable>
            {otpSent && <Pressable onPress={() => setOtpSent(false)}><Text style={styles.changeNumber}>Use a different number</Text></Pressable>}
          </View>
          <Text style={styles.footer}>New to 9tel? <Text style={styles.footerLink} onPress={() => router.replace("/(auth)/register")}>Create an account</Text></Text>
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
  footer: { marginTop: "auto", textAlign: "center", color: colors.inkMuted, fontSize: 14, paddingBottom: 5 }, footerLink: { color: colors.primary, fontWeight: "800" },
});
