import React, { useEffect, useState } from "react";
import { Alert, Linking, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { colors, radius } from "../../constants/theme";

const FALLBACK_FEATURES = [
  "Ad-free calls",
  "Higher monthly limits",
  "Multiple forwarding numbers",
  "Call history",
  "Priority support",
];

export default function PremiumScreen() {
  const router = useRouter();
  const { token, user } = useAuth();
  const [priceLabel, setPriceLabel] = useState("$9.99/month");
  const [features, setFeatures] = useState<string[]>(FALLBACK_FEATURES);
  const [planId, setPlanId] = useState<string>("premium");

  useEffect(() => {
    api.billing
      .getPlans()
      .then((plans) => {
        const premium = plans.find((p) => p.id === "premium");
        if (premium) {
          setPriceLabel(premium.priceLabel);
          setFeatures(premium.features);
          setPlanId(premium.id);
        }
      })
      .catch(() => {});
  }, []);

  const handleUpgrade = async () => {
    if (!token) return;

    // Free-tier users have a guest session with no phone linked — send
    // them to verify one first (carrying planId through so checkout
    // resumes automatically once that's done), rather than requiring
    // registration before they could even try the app.
    if (!user?.phone) {
      router.push({ pathname: "/(auth)/login", params: { intent: "upgrade", planId } });
      return;
    }

    try {
      const { checkoutUrl } = await api.billing.startCheckout(token, planId);
      Linking.openURL(checkoutUrl);
    } catch {
      Alert.alert("Couldn't start checkout", "Please try again.");
    }
  };

  const isPremium = user?.subscriptionTier === "premium" || user?.subscriptionTier === "business";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.heading}>9tel Premium</Text>
        <Text style={styles.subheading}>Make every call seamless.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.noAds}>🚫 No Ads</Text>
        {features.map((f) => (
          <Text key={f} style={styles.feature}>
            ✓ {f}
          </Text>
        ))}
        <Text style={styles.price}>{priceLabel}</Text>

        {isPremium ? (
          <Text style={styles.currentPlan}>You're on Premium already.</Text>
        ) : (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleUpgrade}
          >
            <Text style={styles.buttonText}>Upgrade</Text>
            <Text style={styles.buttonArrow}>→</Text>
          </Pressable>
        )}

        <Text style={styles.cancelNote}>Cancel anytime</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: 20, paddingTop: 8, alignItems: "center" },
  heading: { color: colors.ink, fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  subheading: { color: colors.inkMuted, fontSize: 14, marginTop: 4 },
  card: {
    margin: 20,
    marginTop: 28,
    backgroundColor: colors.surface,
    borderRadius: radius.large,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: "center",
  },
  noAds: { fontSize: 15, color: colors.inkMuted, marginBottom: 16 },
  feature: { fontSize: 14, color: colors.ink, marginBottom: 8, alignSelf: "flex-start" },
  price: { fontSize: 22, fontWeight: "800", color: colors.ink, marginTop: 12, marginBottom: 20 },
  button: {
    minHeight: 56,
    width: "100%",
    borderRadius: radius.medium,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  buttonPressed: { backgroundColor: colors.primaryPressed },
  buttonText: { color: colors.white, fontWeight: "800", fontSize: 15 },
  buttonArrow: { color: colors.white, fontSize: 22 },
  currentPlan: { fontSize: 14, color: colors.success, fontWeight: "700" },
  cancelNote: { fontSize: 12, color: colors.inkMuted, marginTop: 16 },
});
