import React from "react";
import { Stack } from "expo-router";
import { AuthProvider } from "../context/AuthContext";
import { VoiceCallProvider } from "../context/VoiceCallContext";
import IncomingCallOverlay from "../components/IncomingCallOverlay";

export default function RootLayout() {
  return (
    <AuthProvider>
      <VoiceCallProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="checkout-callback" />
          <Stack.Screen name="business-numbers" />
        </Stack>
        {/* Renders over any screen when a Voice SDK call comes in — see
            context/VoiceCallContext.tsx. No-op for PSTN-mode (US/CA/GB)
            users, who never register the Voice SDK at all. */}
        <IncomingCallOverlay />
      </VoiceCallProvider>
    </AuthProvider>
  );
}
