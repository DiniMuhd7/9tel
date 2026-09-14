import React, { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { colors, radius } from "../constants/theme";

const POLL_INTERVAL_MS = 1500;
const POLL_ATTEMPTS = 6; // ~9 seconds total

/**
 * Reached via the deep link Stripe redirects to after Checkout
 * (success_url/cancel_url in services/payments/stripe.ts's
 * startCheckout — 9tel://checkout-callback?status=success&planId=...).
 *
 * Stripe redirects back the instant payment completes, but the webhook
 * that actually flips subscriptionTier in the database can land a beat
 * later — this isn't a hypothetical race, it's routine. So on success
 * this polls GET /api/auth/me a few times waiting for the tier to
 * actually change, rather than assuming it already has, before moving
 * the person off the shared number/extension.
 */
export default function CheckoutCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string; planId?: string }>();
  const { token, user, updateUser } = useAuth();
  const [phase, setPhase] = useState<"checking" | "activated" | "canceled" | "timeout">("checking");

  useEffect(() => {
    if (params.status === "cancel") {
      setPhase("canceled");
      return;
    }
    if (!token) return;

    let cancelled = false;

    (async () => {
      for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
        const { user: refreshed } = await api.auth.getMe(token);
        if (cancelled) return;

        if (refreshed.subscriptionTier !== "free") {
          await updateUser(refreshed);
          try {
            await api.numbers.upgradeToDedicated(token);
          } catch {
            // Tier is updated either way — a dedicated-number hiccup
            // here shouldn't block the person from seeing they're now
            // Premium; Home's own load/retry logic can pick this up.
          }
          if (!cancelled) setPhase("activated");
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
      if (!cancelled) setPhase("timeout");
    })();

    return () => {
      cancelled = true;
    };
  }, [token, params.status]);

  useEffect(() => {
    if (phase === "activated" || phase === "canceled") {
      const timer = setTimeout(() => router.replace("/(tabs)/premium"), 1600);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {phase === "checking" && (
          <>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.title}>Confirming your payment…</Text>
            <Text style={styles.description}>This only takes a moment.</Text>
          </>
        )}
        {phase === "activated" && (
          <>
            <View style={styles.badge}><Text style={styles.badgeText}>✓</Text></View>
            <Text style={styles.title}>You're on Premium</Text>
            <Text style={styles.description}>Taking you back…</Text>
          </>
        )}
        {phase === "canceled" && (
          <>
            <Text style={styles.title}>Checkout canceled</Text>
            <Text style={styles.description}>No charge was made. Taking you back…</Text>
          </>
        )}
        {phase === "timeout" && (
          <>
            <Text style={styles.title}>Still confirming…</Text>
            <Text style={styles.description}>
              Your payment may have gone through — check back on the Premium tab in a moment.
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  badge: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  badgeText: { color: colors.white, fontSize: 26, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 20, fontWeight: "800", textAlign: "center" },
  description: { color: colors.inkMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
});
