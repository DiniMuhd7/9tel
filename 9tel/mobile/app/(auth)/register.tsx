import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");

  const handleContinue = () => {
    // TODO: call api.auth.requestOtp(phone), then navigate to an OTP-entry
    // screen before creating the account server-side.
    router.push("/(auth)/login");
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Create your account</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" />

      <Text style={styles.label}>Phone number</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+234..." keyboardType="phone-pad" />

      <Text style={styles.label}>Email</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />

      <Text style={styles.label}>Country</Text>
      <TextInput style={styles.input} value={country} onChangeText={setCountry} placeholder="Nigeria" />

      <Pressable style={styles.button} onPress={handleContinue}>
        <Text style={styles.buttonText}>Continue</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 60 },
  heading: { fontSize: 22, fontWeight: "800", color: "#111827", marginBottom: 24 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: "#f9fafb", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: "#d1d5db" },
  button: { backgroundColor: "#111827", borderRadius: 10, paddingVertical: 16, alignItems: "center", marginTop: 32 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
