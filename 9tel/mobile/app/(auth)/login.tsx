import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const handleRequestOtp = async () => {
    try {
      await api.auth.requestOtp(phone);
      setOtpSent(true);
    } catch {
      Alert.alert("Couldn't send code", "Check the number and try again.");
    }
  };

  const handleVerify = async () => {
    try {
      const { token, user } = await api.auth.verifyOtp(phone, code);
      await signIn(token, user);
      router.replace("/(tabs)");
    } catch {
      Alert.alert("Invalid code", "Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Log in</Text>

      <Text style={styles.label}>Phone number</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+234..." keyboardType="phone-pad" editable={!otpSent} />

      {otpSent && (
        <>
          <Text style={styles.label}>Enter code</Text>
          <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="6-digit code" keyboardType="number-pad" />
        </>
      )}

      <Pressable style={styles.button} onPress={otpSent ? handleVerify : handleRequestOtp}>
        <Text style={styles.buttonText}>{otpSent ? "Verify & Log In" : "Send Code"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60 },
  heading: { fontSize: 22, fontWeight: "800", color: "#111827", marginBottom: 24 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: "#f9fafb", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: "#d1d5db" },
  button: { backgroundColor: "#111827", borderRadius: 10, paddingVertical: 16, alignItems: "center", marginTop: 32 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
