import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { NineTelNumber } from "../../types/models";
import { colors, radius } from "../../constants/theme";

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

type DestinationStep = "number" | "verify";

export default function HomeScreen() {
  const { token, user } = useAuth();
  const [numberInfo, setNumberInfo] = useState<NineTelNumber | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState<DestinationStep>("number");
  const [destinationInput, setDestinationInput] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadNumber = useCallback(async (refresh = false) => {
    if (!token) return;
    refresh ? setIsRefreshing(true) : setIsLoading(true);
    try {
      setNumberInfo(await api.numbers.getMine(token));
    } catch {
      if (!refresh) setNumberInfo(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [token]);

  useEffect(() => { loadNumber(); }, [loadNumber]);

  const openDestinationModal = () => {
    setDestinationInput(numberInfo?.destinationE164 ?? "");
    setCode("");
    setStep(numberInfo?.destinationE164 && !numberInfo.destinationVerified ? "verify" : "number");
    setEditing(true);
  };
  const closeDestinationModal = () => { if (!submitting) setEditing(false); };

  const saveDestination = async () => {
    const destination = destinationInput.trim();
    if (!E164_PATTERN.test(destination)) return Alert.alert("Use an international number", "Enter the full number starting with + and country code.");
    if (!token) return;
    setSubmitting(true);
    try {
      const updated = await api.numbers.setDestination(token, destination);
      setNumberInfo(updated);
      setStep("verify");
      setCode("");
    } catch {
      Alert.alert("Couldn't update your forwarding number", "Please check it and try again.");
    } finally { setSubmitting(false); }
  };

  const verifyDestination = async () => {
    if (code.trim().length !== 6) return Alert.alert("Enter the 6-digit code", "Check the code sent to your forwarding phone.");
    if (!token) return;
    setSubmitting(true);
    try {
      const { verified } = await api.numbers.verifyDestination(token, code.trim());
      if (!verified) return Alert.alert("That code didn't work", "Please try again or request a new code.");
      setNumberInfo((current) => current ? { ...current, destinationVerified: true } : current);
      setEditing(false);
      Alert.alert("Forwarding is ready", "Calls to your 9tel number will now reach this phone.");
    } catch {
      Alert.alert("We couldn't verify that code", "Please try again.");
    } finally { setSubmitting(false); }
  };

  const isVerified = Boolean(numberInfo?.destinationE164 && numberInfo.destinationVerified);
  const greeting = user?.name?.trim().split(" ")[0] || "there";

  return <SafeAreaView style={styles.safeArea}><View style={styles.container}>
    <View style={styles.header}><View><Text style={styles.greeting}>Good to see you, {greeting}</Text><Text style={styles.subheading}>Your calling setup</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Refresh number details" style={styles.refreshButton} onPress={() => loadNumber(true)} disabled={isRefreshing}><Text style={styles.refreshText}>{isRefreshing ? "…" : "↻"}</Text></Pressable></View>
    {isLoading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Loading your number…</Text></View> : <>
      <View style={styles.numberCard}><View style={styles.cardTop}><View><Text style={styles.cardLabel}>YOUR 9TEL NUMBER</Text><Text style={styles.number}>{numberInfo?.e164 ?? "Number unavailable"}</Text></View><View style={[styles.statusPill, numberInfo?.status === "active" ? styles.statusActive : styles.statusPending]}><View style={styles.statusDot} /><Text style={styles.statusText}>{numberInfo?.status === "active" ? "Active" : "Setting up"}</Text></View></View>{numberInfo?.numberType === "toll-free" && <Text style={styles.tollFree}>Toll-free for callers to dial</Text>}<Text style={styles.cardHint}>Share this number with anyone who needs to reach you.</Text></View>
      <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Call forwarding</Text><Text style={styles.sectionDescription}>Choose where your calls should ring.</Text></View></View>
      <Pressable accessibilityRole="button" style={({ pressed }) => [styles.destinationCard, pressed && styles.cardPressed]} onPress={openDestinationModal}><View style={[styles.destinationIcon, isVerified && styles.destinationIconReady]}><Text style={styles.destinationIconText}>{isVerified ? "✓" : "→"}</Text></View><View style={styles.destinationCopy}><Text style={styles.destinationLabel}>{isVerified ? "Forwarding to" : numberInfo?.destinationE164 ? "Verify forwarding number" : "Add a forwarding number"}</Text><Text style={styles.destinationValue}>{numberInfo?.destinationE164 ?? "Calls are not being forwarded yet"}</Text></View><Text style={styles.chevron}>›</Text></Pressable>
      {!isVerified && <View style={styles.notice}><Text style={styles.noticeTitle}>Finish your setup</Text><Text style={styles.noticeText}>Verify a forwarding phone to start receiving your 9tel calls.</Text><Pressable accessibilityRole="button" onPress={openDestinationModal}><Text style={styles.noticeAction}>{numberInfo?.destinationE164 ? "Enter verification code" : "Add phone number"}</Text></Pressable></View>}
    </>}
    <Modal visible={editing} transparent animationType="slide" onRequestClose={closeDestinationModal}><View style={styles.modalOverlay}><Pressable style={styles.modalDismiss} onPress={closeDestinationModal} /><View style={styles.modalCard}><View style={styles.handle} /><Text style={styles.modalTitle}>{step === "number" ? "Where should calls ring?" : "Verify your phone"}</Text><Text style={styles.modalDescription}>{step === "number" ? "We’ll send a code before forwarding is enabled." : `Enter the code sent to ${numberInfo?.destinationE164 ?? destinationInput}.`}</Text>{step === "number" ? <><Text style={styles.inputLabel}>FORWARDING PHONE</Text><TextInput style={styles.input} value={destinationInput} onChangeText={setDestinationInput} placeholder="+234 800 000 0000" placeholderTextColor="#8AA0B9" keyboardType="phone-pad" autoComplete="tel" autoFocus /></> : <><Text style={styles.inputLabel}>6-DIGIT CODE</Text><TextInput style={[styles.input, styles.codeInput]} value={code} onChangeText={setCode} placeholder="000000" placeholderTextColor="#8AA0B9" keyboardType="number-pad" maxLength={6} autoFocus /></>}<Pressable accessibilityRole="button" style={({ pressed }) => [styles.modalButton, (pressed || submitting) && styles.buttonPressed]} onPress={step === "number" ? saveDestination : verifyDestination} disabled={submitting}><Text style={styles.modalButtonText}>{submitting ? "Please wait…" : step === "number" ? "Send verification code" : "Verify and activate"}</Text><Text style={styles.modalButtonArrow}>→</Text></Pressable>{step === "verify" && <Pressable onPress={() => setStep("number")} disabled={submitting}><Text style={styles.changeNumber}>Change phone number</Text></Pressable>}</View></View></Modal>
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas }, container: { flex: 1, padding: 20 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8 }, greeting: { color: colors.ink, fontSize: 22, lineHeight: 27, fontWeight: "800", letterSpacing: -0.5 }, subheading: { color: colors.inkMuted, fontSize: 14, marginTop: 2 }, refreshButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }, refreshText: { color: colors.primary, fontSize: 22, fontWeight: "600" }, loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }, loadingText: { color: colors.inkMuted, fontSize: 14 }, numberCard: { backgroundColor: colors.ink, borderRadius: radius.large, marginTop: 25, padding: 22, shadowColor: "#0A1D38", shadowOpacity: 0.16, shadowOffset: { width: 0, height: 10 }, shadowRadius: 16, elevation: 5 }, cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, cardLabel: { color: "#AFC1D8", fontSize: 10, fontWeight: "800", letterSpacing: 1 }, number: { color: colors.white, fontSize: 23, fontWeight: "800", letterSpacing: -0.55, marginTop: 9 }, statusPill: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.pill }, statusActive: { backgroundColor: "rgba(72, 207, 153, 0.16)" }, statusPending: { backgroundColor: "rgba(255, 198, 86, 0.17)" }, statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#59D9A1" }, statusText: { color: colors.white, fontSize: 11, fontWeight: "700" }, tollFree: { color: "#8DDBBE", fontSize: 12, fontWeight: "700", marginTop: 19 }, cardHint: { color: "#B7C6DA", fontSize: 13, lineHeight: 19, marginTop: 6 }, sectionHeader: { marginTop: 29, marginBottom: 12 }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" }, sectionDescription: { color: colors.inkMuted, fontSize: 13, marginTop: 3 }, destinationCard: { minHeight: 82, borderRadius: radius.medium, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 12 }, cardPressed: { opacity: 0.72 }, destinationIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }, destinationIconReady: { backgroundColor: "#E0F6ED" }, destinationIconText: { color: colors.primary, fontSize: 20, fontWeight: "800" }, destinationCopy: { flex: 1 }, destinationLabel: { color: colors.ink, fontSize: 14, fontWeight: "800" }, destinationValue: { color: colors.inkMuted, fontSize: 12, marginTop: 4 }, chevron: { color: colors.inkMuted, fontSize: 29, lineHeight: 30 }, notice: { backgroundColor: colors.canvasTint, borderRadius: radius.medium, marginTop: 14, padding: 16 }, noticeTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" }, noticeText: { color: colors.inkMuted, fontSize: 13, lineHeight: 18, marginTop: 4 }, noticeAction: { color: colors.primary, fontSize: 13, fontWeight: "800", marginTop: 10 }, modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(10, 29, 56, 0.48)" }, modalDismiss: { flex: 1 }, modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.large, borderTopRightRadius: radius.large, padding: 24, paddingBottom: 32 }, handle: { width: 38, height: 4, borderRadius: radius.pill, backgroundColor: colors.border, alignSelf: "center", marginBottom: 21 }, modalTitle: { color: colors.ink, fontSize: 23, fontWeight: "800", letterSpacing: -0.4 }, modalDescription: { color: colors.inkMuted, fontSize: 14, lineHeight: 20, marginTop: 7 }, inputLabel: { color: colors.inkMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 24, marginBottom: 8 }, input: { minHeight: 56, borderRadius: radius.small, backgroundColor: colors.canvas, paddingHorizontal: 16, color: colors.ink, fontSize: 16, borderWidth: 1, borderColor: colors.border }, codeInput: { letterSpacing: 8, fontSize: 20, fontWeight: "700", textAlign: "center" }, modalButton: { minHeight: 56, borderRadius: radius.medium, backgroundColor: colors.primary, marginTop: 20, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, buttonPressed: { backgroundColor: colors.primaryPressed, opacity: 0.88 }, modalButtonText: { color: colors.white, fontSize: 16, fontWeight: "800" }, modalButtonArrow: { color: colors.white, fontSize: 25 }, changeNumber: { color: colors.primary, textAlign: "center", fontSize: 14, fontWeight: "800", marginTop: 18 },
});
