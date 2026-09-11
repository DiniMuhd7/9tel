import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { CallRecord } from "../../types/models";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function CallsScreen() {
  const { token } = useAuth();
  const [calls, setCalls] = useState<CallRecord[]>([]);

  useEffect(() => {
    if (!token) return;
    api.calls.list(token).then(setCalls).catch(() => {});
  }, [token]);

  return (
    <View style={styles.container}>
      <FlatList
        data={calls}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 20 }}
        ListEmptyComponent={<Text style={styles.empty}>No calls yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View>
              <Text style={styles.caller}>{item.callerLabel}</Text>
              <Text style={styles.number}>{item.callerNumber}</Text>
              <Text style={styles.meta}>
                {new Date(item.startedAt).toLocaleString()} · {formatDuration(item.durationSeconds)}
              </Text>
            </View>
            <Text style={[styles.status, item.status !== "answered" && styles.statusMissed]}>
              {item.status}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  caller: { fontSize: 15, fontWeight: "700", color: "#111827" },
  number: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  meta: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  status: { fontSize: 12, fontWeight: "600", color: "#22c55e", textTransform: "capitalize" },
  statusMissed: { color: "#ef4444" },
  empty: { textAlign: "center", color: "#9ca3af", marginTop: 40 },
});
