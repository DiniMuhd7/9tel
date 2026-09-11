import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Linking, Alert } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";

const FALLBACK_FEATURES = [
  "Ad-free calls",
  "Higher monthly limits",
  "Multiple forwarding numbers",
  "Call history",
  "Priority support",
];

export default function PremiumScreen() {
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
    try {
      const { checkoutUrl } = await api.billing.startCheckout(token, planId);
      Linking.openURL(checkoutUrl);
    } catch {
      Alert.alert("Couldn't start checkout", "Please try again.");
    }
  };

  const isPremium = user?.subscriptionTier === "premium" || user?.subscriptionTier === "business";

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>9tel Premium</Text>
      <Text style={styles.noAds}>🚫 No Ads</Text>
      <Text style={styles.subheading}>Make every call seamless.</Text>

      {features.map((f) => (
        <Text key={f} style={styles.feature}>
          ✓ {f}
        </Text>
      ))}

      <Text style={styles.price}>{priceLabel}</Text>

      {isPremium ? (
        <Text style={styles.currentPlan}>You're on Premium already.</Text>
      ) : (
        <Pressable style={styles.button} onPress={handleUpgrade}>
          <Text style={styles.buttonText}>Upgrade</Text>
        </Pressable>
      )}

      <Text style={styles.cancelNote}>Cancel anytime</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, alignItems: "center", paddingTop: 40 },
  heading: { fontSize: 24, fontWeight: "800", color: "#111827" },
  noAds: { fontSize: 15, color: "#6b7280", marginTop: 12 },
  subheading: { fontSize: 14, color: "#4b5563", marginTop: 4, marginBottom: 20 },
  feature: { fontSize: 14, color: "#111827", marginBottom: 8, alignSelf: "flex-start" },
  price: { fontSize: 22, fontWeight: "800", color: "#111827", marginTop: 20, marginBottom: 20 },
  button: { backgroundColor: "#111827", borderRadius: 12, paddingVertical: 16, paddingHorizontal: 48 },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  currentPlan: { fontSize: 14, color: "#22c55e", fontWeight: "700" },
  cancelNote: { fontSize: 12, color: "#9ca3af", marginTop: 16 },
});
