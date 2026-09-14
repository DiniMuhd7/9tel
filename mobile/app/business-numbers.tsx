import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { NineTelNumber } from "../types/models";
import { colors, radius } from "../constants/theme";

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

/**
 * Business-tier-only screen (reached from Profile, not a tab — the
 * original nav design deliberately caps the app at 4 tabs). Lists every
 * number the account holds and lets the person add more, up to the
 * plan's maxNumbers (services/payments/stripe.ts on the backend).
 *
 * Per-number destination editing here is intentionally minimal — it
 * reuses the same PATCH/verify flow Home uses for the primary number,
 * just targeted at a specific numberId instead of the back-compat
 * default. There's no per-number Voice-SDK-vs-PSTN distinction shown
 * beyond what's already true of the account's country.
 */
export default function BusinessNumbersScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [numbers, setNumbers] = useState<NineTelNumber[]>([]);
  const [maxNumbers, setMaxNumbers] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [step, setStep] = useState<"number" | "verify">("number");
  const [destinationInput, setDestinationInput] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [list, plans] = await Promise.all([api.numbers.list(token), api.billing.getPlans()]);
      setNumbers(list);
      setMaxNumbers(plans.find((p) => p.id === "business")?.maxNumbers ?? null);
    } catch {
      // leave whatever was already on screen
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleAddNumber = async () => {
    if (!token) return;
    setIsProvisioning(true);
    try {
      await api.numbers.provision(token);
      await load();
    } catch (err: any) {
      Alert.alert("Couldn't add a number", err?.message ?? "Please try again.");
    } finally {
      setIsProvisioning(false);
    }
  };

  const openEdit = (number: NineTelNumber) => {
    setEditingId(number.id);
    setDestinationInput(number.destinationE164 ?? "");
    setCode("");
    setStep(number.destinationE164 && !number.destinationVerified ? "verify" : "number");
  };
  const closeEdit = () => { if (!submitting) setEditingId(null); };

  const saveDestination = async () => {
    const destination = destinationInput.trim();
    if (!E164_PATTERN.test(destination)) return Alert.alert("Use an international number", "Enter the full number starting with + and country code.");
    if (!token || !editingId) return;
    setSubmitting(true);
    try {
      const { codeSent, ...updated } = await api.numbers.setDestination(token, destination, editingId);
      setNumbers((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      setStep("verify");
      setCode("");
      if (!codeSent) Alert.alert("Number saved, but the code didn't send", "You can try again from this screen.");
    } catch {
      Alert.alert("Couldn't update that number", "Please check it and try again.");
    } finally { setSubmitting(false); }
  };

  const verifyDestination = async () => {
    if (code.trim().length !== 6 || !token || !editingId) return Alert.alert("Enter the 6-digit code", "Check the code sent to the forwarding phone.");
    setSubmitting(true);
    try {
      const { verified } = await api.numbers.verifyDestination(token, code.trim(), editingId);
      if (!verified) return Alert.alert("That code didn't work", "Please try again.");
      setNumbers((prev) => prev.map((n) => (n.id === editingId ? { ...n, destinationVerified: true } : n)));
      setEditingId(null);
    } catch {
      Alert.alert("We couldn't verify that code", "Please try again.");
    } finally { setSubmitting(false); }
  };

  const atLimit = maxNumbers !== null && numbers.length >= maxNumbers;

  if (user?.subscriptionTier !== "business") {
    // Guard for direct navigation/deep-linking — Profile only ever
    // links here for Business accounts, but this keeps the screen safe
    // to land on regardless.
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.heading}>Business numbers</Text>
          <Text style={styles.description}>This is a Business-plan feature.</Text>
          <Pressable style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>‹  Back</Text></Pressable>
        <Text style={styles.heading}>Business numbers</Text>
        <Text style={styles.description}>
          {maxNumbers !== null ? `${numbers.length} of ${maxNumbers} numbers used` : "Manage every number on this account"}
        </Text>

        {isLoading ? (
          <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <FlatList
            style={styles.list}
            data={numbers}
            keyExtractor={(n) => n.id}
            renderItem={({ item }) => (
              <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => openEdit(item)}>
                <View>
                  <Text style={styles.rowNumber}>{item.e164}</Text>
                  <Text style={styles.rowDestination}>
                    {item.destinationE164
                      ? item.destinationVerified ? `Forwards to ${item.destinationE164}` : `Pending verification · ${item.destinationE164}`
                      : "No forwarding number set"}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            )}
          />
        )}

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.addButton, (pressed || atLimit || isProvisioning) && styles.addButtonDisabled]}
          onPress={handleAddNumber}
          disabled={atLimit || isProvisioning}
        >
          <Text style={styles.addButtonText}>
            {isProvisioning ? "Adding…" : atLimit ? "Plan limit reached" : "Add a number"}
          </Text>
        </Pressable>
      </View>

      <Modal visible={editingId !== null} transparent animationType="slide" onRequestClose={closeEdit}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={closeEdit} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{step === "number" ? "Where should this number ring?" : "Verify this phone"}</Text>
            {step === "number" ? (
              <TextInput style={styles.input} value={destinationInput} onChangeText={setDestinationInput} placeholder="+1 555 000 0000" placeholderTextColor="#8AA0B9" keyboardType="phone-pad" autoFocus />
            ) : (
              <TextInput style={[styles.input, styles.codeInput]} value={code} onChangeText={setCode} placeholder="000000" placeholderTextColor="#8AA0B9" keyboardType="number-pad" maxLength={6} autoFocus />
            )}
            <Pressable style={({ pressed }) => [styles.modalButton, (pressed || submitting) && styles.buttonPressed]} onPress={step === "number" ? saveDestination : verifyDestination} disabled={submitting}>
              <Text style={styles.modalButtonText}>{submitting ? "Please wait…" : step === "number" ? "Send code" : "Verify"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1, padding: 20 },
  back: { color: colors.inkMuted, fontSize: 15, fontWeight: "700", marginBottom: 10 },
  heading: { color: colors.ink, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  description: { color: colors.inkMuted, fontSize: 14, marginTop: 4, marginBottom: 18 },
  backLink: { marginTop: 16 },
  backLinkText: { color: colors.primary, fontWeight: "700" },
  loading: { paddingVertical: 40, alignItems: "center" },
  list: { flex: 1 },
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.surface, borderRadius: radius.medium, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10,
  },
  rowPressed: { opacity: 0.7 },
  rowNumber: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  rowDestination: { color: colors.inkMuted, fontSize: 12, marginTop: 3 },
  chevron: { color: colors.inkMuted, fontSize: 24 },
  addButton: { minHeight: 52, borderRadius: radius.medium, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 8 },
  addButtonDisabled: { backgroundColor: colors.border },
  addButtonText: { color: colors.white, fontWeight: "800", fontSize: 15 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(10, 29, 56, 0.48)" },
  modalDismiss: { flex: 1 },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.large, borderTopRightRadius: radius.large, padding: 24, paddingBottom: 32 },
  modalTitle: { color: colors.ink, fontSize: 19, fontWeight: "800", marginBottom: 16 },
  input: { minHeight: 52, borderRadius: radius.small, backgroundColor: colors.canvas, paddingHorizontal: 16, color: colors.ink, fontSize: 16, borderWidth: 1, borderColor: colors.border },
  codeInput: { letterSpacing: 8, fontSize: 18, fontWeight: "700", textAlign: "center" },
  modalButton: { minHeight: 52, borderRadius: radius.medium, backgroundColor: colors.primary, marginTop: 16, alignItems: "center", justifyContent: "center" },
  buttonPressed: { backgroundColor: colors.primaryPressed, opacity: 0.9 },
  modalButtonText: { color: colors.white, fontSize: 15, fontWeight: "800" },
});
