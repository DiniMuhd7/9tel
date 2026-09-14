import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../constants/theme";

export function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <View style={[styles.mark, inverse && styles.markInverse]} accessibilityLabel="9tel">
      <Text style={[styles.nine, inverse && styles.nineInverse]}>9</Text>
      <View style={[styles.signal, inverse && styles.signalInverse]} />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { width: 42, height: 42, borderRadius: radius.medium, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  markInverse: { backgroundColor: "rgba(255,255,255,0.16)" },
  nine: { color: colors.primary, fontSize: 25, lineHeight: 28, fontWeight: "800" },
  nineInverse: { color: colors.white },
  signal: { position: "absolute", width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary, right: 9, bottom: 9, borderWidth: 1.5, borderColor: colors.primarySoft },
  signalInverse: { backgroundColor: "#8DDBBE", borderColor: "rgba(255,255,255,0.16)" },
});
