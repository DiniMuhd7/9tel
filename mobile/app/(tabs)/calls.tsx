import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { CallRecord } from "../../types/models";
import { colors, radius } from "../../constants/theme";
import { ensureContactsLoaded, resolveCallerName } from "../../services/contacts";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function CallsScreen() {
  const { token } = useAuth();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Bumped once contacts finish loading, purely to trigger a re-render so
  // resolveCallerName's results actually show up — the calls list itself
  // doesn't change when this happens.
  const [contactsVersion, setContactsVersion] = useState(0);

  const loadCalls = useCallback(
    async (refresh = false) => {
      if (!token) return;
      refresh ? setIsRefreshing(true) : setIsLoading(true);
      try {
        setCalls(await api.calls.list(token));
      } catch {
        // keep whatever we already have on screen
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token]
  );

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  useEffect(() => {
    // Contacts permission is requested here — the first time someone
    // opens Calls, not at app launch — since it's only actually needed
    // for this screen's display, and asking earlier would be asking
    // before there's a reason to.
    ensureContactsLoaded().then(() => setContactsVersion((v) => v + 1));
  }, []);

  const displayNameFor = (call: CallRecord) => resolveCallerName(call.callerNumber) ?? call.callerLabel;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Calls</Text>
          <Text style={styles.subheading}>Your recent call history</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh calls"
          style={styles.refreshButton}
          onPress={() => loadCalls(true)}
          disabled={isRefreshing}
        >
          <Text style={styles.refreshText}>{isRefreshing ? "…" : "↻"}</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading calls…</Text>
        </View>
      ) : (
        <FlatList
          data={calls}
          extraData={contactsVersion}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.empty}>No calls yet.</Text>}
          renderItem={({ item }) => {
            const displayName = displayNameFor(item);
            const isKnownContact = displayName !== item.callerNumber;
            return (
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.caller}>{displayName}</Text>
                  {/* Only show the raw number as a second line when we
                      resolved an actual contact name for it — otherwise
                      it'd just repeat what's already shown above. */}
                  {isKnownContact && <Text style={styles.number}>{item.callerNumber}</Text>}
                  <Text style={styles.meta}>
                    {new Date(item.startedAt).toLocaleString()} · {formatDuration(item.durationSeconds)}
                  </Text>
                </View>
                <Text style={[styles.status, item.status !== "answered" && styles.statusMissed]}>
                  {item.status}
                </Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  heading: { color: colors.ink, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  subheading: { color: colors.inkMuted, fontSize: 14, marginTop: 2 },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshText: { color: colors.primary, fontSize: 22, fontWeight: "600" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: colors.inkMuted, fontSize: 14 },
  listContent: { padding: 20, paddingTop: 12 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  rowLeft: { flex: 1 },
  caller: { fontSize: 15, fontWeight: "700", color: colors.ink },
  number: { fontSize: 13, color: colors.inkMuted, marginTop: 2 },
  meta: { fontSize: 12, color: colors.inkMuted, marginTop: 2, opacity: 0.8 },
  status: { fontSize: 12, fontWeight: "700", color: colors.success, textTransform: "capitalize" },
  statusMissed: { color: colors.danger },
  empty: { textAlign: "center", color: colors.inkMuted, marginTop: 40 },
});
