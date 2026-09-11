import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Modal, Alert } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { NineTelNumber } from "../../types/models";

export default function HomeScreen() {
  const { token } = useAuth();
  const [numberInfo, setNumberInfo] = useState<NineTelNumber | null>(null);
  const [editing, setEditing] = useState(false);
  const [destinationInput, setDestinationInput] = useState("");

  useEffect(() => {
    if (!token) return;
    api.numbers.getMine(token).then(setNumberInfo).catch(() => {});
  }, [token]);

  const handleSaveDestination = async () => {
    if (!token) return;
    try {
      const updated = await api.numbers.setDestination(token, destinationInput);
      setNumberInfo(updated);
      setEditing(false);
      Alert.alert("Verification needed", "We sent a code to confirm this number before forwarding starts.");
    } catch {
      Alert.alert("Couldn't update", "Check the number and try again.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Your 9tel Number</Text>
      <Text style={styles.number}>{numberInfo?.e164 ?? "—"}</Text>
      {numberInfo?.numberType === "toll-free" && (
        <Text style={styles.tollFreeTag}>Toll-free · free for callers to dial</Text>
      )}

      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: numberInfo?.status === "active" ? "#22c55e" : "#f59e0b" }]} />
        <Text style={styles.statusText}>{numberInfo?.status ?? "loading"}</Text>
      </View>

      <Text style={[styles.label, { marginTop: 24 }]}>Forward calls to</Text>
      <Text style={styles.destination}>{numberInfo?.destinationE164 ?? "Not set"}</Text>
      {numberInfo && !numberInfo.destinationVerified && (
        <Text style={styles.unverified}>Pending verification</Text>
      )}

      <Pressable style={styles.editButton} onPress={() => setEditing(true)}>
        <Text style={styles.editButtonText}>Edit Number</Text>
      </Pressable>

      <Modal visible={editing} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeading}>Forwarding number</Text>
            <TextInput
              style={styles.input}
              value={destinationInput}
              onChangeText={setDestinationInput}
              placeholder="+234..."
              keyboardType="phone-pad"
            />
            <Pressable style={styles.saveButton} onPress={handleSaveDestination}>
              <Text style={styles.saveButtonText}>Save</Text>
            </Pressable>
            <Pressable onPress={() => setEditing(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 40 },
  label: { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  number: { fontSize: 28, fontWeight: "800", color: "#111827", marginTop: 4 },
  tollFreeTag: { fontSize: 12, color: "#22c55e", fontWeight: "700", marginTop: 4 },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 13, color: "#374151", textTransform: "capitalize" },
  destination: { fontSize: 18, fontWeight: "700", color: "#111827", marginTop: 4 },
  unverified: { fontSize: 12, color: "#f59e0b", marginTop: 4 },
  editButton: { marginTop: 20, alignSelf: "flex-start", borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  editButtonText: { fontSize: 13, fontWeight: "600", color: "#111827" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24 },
  modalHeading: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  input: { backgroundColor: "#f9fafb", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: "#d1d5db", marginBottom: 16 },
  saveButton: { backgroundColor: "#111827", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  saveButtonText: { color: "#fff", fontWeight: "700" },
  cancelText: { textAlign: "center", color: "#6b7280", marginTop: 12, fontSize: 13 },
});
