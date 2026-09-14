import React from "react";
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { colors, radius } from "../../constants/theme";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const isGuest = !user?.phone;

  const handleSignOut = async () => {
    // Note: the device ID persists in local storage independently of the
    // signed-in session (see services/deviceId.ts). On next launch, the
    // root gate's guest bootstrap will look that same device ID up again
    // — for a phone-linked account, that means it logs straight back
    // into THIS account rather than a fresh guest session. "Sign out" is
    // therefore mainly useful before logging into a DIFFERENT account on
    // this device, not as a way to fully log out of it.
    await signOut();
    router.replace("/(auth)/login");
  };

  const handleLogInToAccount = () => {
    router.push("/(auth)/login");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.heading}>Profile</Text>
      </View>

      <View style={styles.card}>
        {isGuest ? (
          <>
            <Text style={styles.name}>Guest</Text>
            <Text style={styles.detail}>No account linked yet</Text>
          </>
        ) : (
          <>
            <Text style={styles.name}>{user?.name || "—"}</Text>
            <Text style={styles.detail}>{user?.email ?? "—"}</Text>
            <Text style={styles.detail}>{user?.phone ?? "—"}</Text>
            <Text style={styles.detail}>{user?.country ?? "—"}</Text>
          </>
        )}
        <Text style={styles.tier}>Plan: {user?.subscriptionTier ?? "free"}</Text>
      </View>

      {user?.subscriptionTier === "business" && (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.linkButton, pressed && styles.linkButtonPressed]}
          onPress={() => router.push("/business-numbers")}
        >
          <Text style={styles.linkButtonText}>Manage business numbers</Text>
        </Pressable>
      )}

      {isGuest ? (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.linkButton, pressed && styles.linkButtonPressed]}
          onPress={handleLogInToAccount}
        >
          <Text style={styles.linkButtonText}>Log in to a Premium account</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutPressed]}
          onPress={() =>
            Alert.alert("Sign out?", "You'll need to log in again to access this account on this device.", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: handleSignOut },
            ])
          }
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas, padding: 20 },
  header: { paddingTop: 8, marginBottom: 20 },
  heading: { color: colors.ink, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.large,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  name: { fontSize: 20, fontWeight: "800", color: colors.ink },
  detail: { fontSize: 14, color: colors.inkMuted, marginTop: 6 },
  tier: { fontSize: 14, color: colors.ink, fontWeight: "700", marginTop: 14, textTransform: "capitalize" },
  linkButton: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.medium,
    paddingVertical: 14,
    alignItems: "center",
  },
  linkButtonPressed: { backgroundColor: colors.primarySoft },
  linkButtonText: { color: colors.primary, fontWeight: "700" },
  signOutButton: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.medium,
    paddingVertical: 14,
    alignItems: "center",
  },
  signOutPressed: { backgroundColor: "rgba(211, 69, 69, 0.06)" },
  signOutText: { color: colors.danger, fontWeight: "700" },
});
