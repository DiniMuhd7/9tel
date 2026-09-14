import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { CallInvite } from "@twilio/voice-react-native-sdk";
import { voiceClient } from "../services/voiceClient";
import { api } from "../services/api";
import { useAuth } from "./AuthContext";
import { NineTelNumber } from "../types/models";

interface VoiceCallContextValue {
  incomingCall: CallInvite | null;
  isRegistered: boolean;
  accept: () => Promise<void>;
  reject: () => Promise<void>;
  /**
   * Call this whenever a screen loads the user's NineTelNumber (Home's
   * loadNumber, for instance) so Voice SDK registration follows it
   * automatically. Registration only actually happens when
   * destinationType is "client" — US/CA/GB (PSTN) users never trigger it.
   */
  reportNumber: (number: NineTelNumber | null) => void;
}

const VoiceCallContext = createContext<VoiceCallContextValue | undefined>(undefined);

export function VoiceCallProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [destinationType, setDestinationType] = useState<NineTelNumber["destinationType"] | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallInvite | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const registeredForToken = useRef<string | null>(null);

  useEffect(() => {
    voiceClient.setIncomingCallHandler((callInvite) => setIncomingCall(callInvite));
    return () => voiceClient.setIncomingCallHandler(null);
  }, []);

  useEffect(() => {
    (async () => {
      if (!token || destinationType !== "client") return;
      if (registeredForToken.current === token) return; // already registered this session
      try {
        const { token: accessToken } = await api.voice.getToken(token);
        await voiceClient.register(accessToken);
        registeredForToken.current = token;
        setIsRegistered(true);
      } catch {
        // Voice SDK isn't configured server-side yet (TWILIO_API_KEY_*
        // envs — see voiceToken.ts), or this is running in Expo Go where
        // the native module isn't available. Fail quietly; PSTN-mode
        // users never hit this path at all.
        setIsRegistered(false);
      }
    })();
  }, [token, destinationType]);

  const reportNumber = (number: NineTelNumber | null) => setDestinationType(number?.destinationType ?? null);

  const accept = async () => {
    if (!incomingCall) return;
    await voiceClient.acceptCall(incomingCall);
    setIncomingCall(null);
  };

  const reject = async () => {
    if (!incomingCall) return;
    await voiceClient.rejectCall(incomingCall);
    setIncomingCall(null);
  };

  return (
    <VoiceCallContext.Provider value={{ incomingCall, isRegistered, accept, reject, reportNumber }}>
      {children}
    </VoiceCallContext.Provider>
  );
}

export function useVoiceCall() {
  const ctx = useContext(VoiceCallContext);
  if (!ctx) throw new Error("useVoiceCall must be used within VoiceCallProvider");
  return ctx;
}
