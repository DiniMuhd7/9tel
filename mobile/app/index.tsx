import React, { useEffect, useRef } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { colors } from "../constants/theme";

/**
 * Every app open lands here first. Free-tier calling needs no account at
 * all, so this silently creates (or resumes) a device-scoped guest
 * session and drops straight into the app — no Welcome/Login screen in
 * the way. Registration only happens later, on demand, when the user
 * links a phone at Premium upgrade time (see (tabs)/premium.tsx and
 * (auth)/login.tsx's `intent=upgrade` handling). The (auth) screens are
 * still reachable, just not part of the default first-run path anymore.
 */
export default function RootGate() {
  const { isLoading, user, bootstrapGuestSession } = useAuth();
  const router = useRouter();
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (isLoading || hasNavigated.current) return;

    (async () => {
      if (!user) {
        try {
          await bootstrapGuestSession();
        } catch {
          // If the guest bootstrap call fails (e.g. offline on first
          // launch), fall through to the app anyway rather than
          // blocking indefinitely — screens that need a user handle
          // that absence themselves.
        }
      }
      hasNavigated.current = true;
      router.replace("/(tabs)");
    })();
  }, [isLoading, user]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
});
