import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useVoiceCall } from "../context/VoiceCallContext";
import { colors, radius } from "../constants/theme";

/**
 * Rendered once, from the root layout, so it can appear over any screen
 * regardless of which tab is active when a call comes in.
 */
export default function IncomingCallOverlay() {
  const { incomingCall, accept, reject } = useVoiceCall();

  if (!incomingCall) return null;

  // The CallInvite carries the original PSTN caller's number in its
  // custom parameters, set by the <Dial><Client> TwiML — falls back to a
  // generic label if that's ever missing.
  const callerLabel = (incomingCall as any).customParameters?.get?.("from") ?? "Incoming call";

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.label}>9tel</Text>
          <Text style={styles.caller}>{callerLabel}</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decline call"
              style={[styles.button, styles.decline]}
              onPress={reject}
            >
              <Text style={styles.buttonText}>Decline</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Accept call"
              style={[styles.button, styles.accept]}
              onPress={accept}
            >
              <Text style={styles.buttonText}>Accept</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(16, 33, 59, 0.92)", alignItems: "center", justifyContent: "center" },
  card: { width: "85%", alignItems: "center" },
  label: { color: colors.white, fontSize: 14, fontWeight: "700", opacity: 0.7, letterSpacing: 1.5 },
  caller: { color: colors.white, fontSize: 28, fontWeight: "800", marginTop: 12, marginBottom: 48, textAlign: "center" },
  actions: { flexDirection: "row", gap: 16, width: "100%" },
  button: { flex: 1, minHeight: 56, borderRadius: radius.medium, alignItems: "center", justifyContent: "center" },
  decline: { backgroundColor: colors.danger },
  accept: { backgroundColor: colors.success },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "800" },
});
