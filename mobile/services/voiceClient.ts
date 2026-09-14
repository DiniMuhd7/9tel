/**
 * Thin wrapper around @twilio/voice-react-native-sdk. Kept in one place
 * so the rest of the app (VoiceCallContext) doesn't touch the SDK
 * directly — useful both for testability and because this SDK requires
 * a custom dev client / EAS build (it has native modules and will NOT
 * run in plain Expo Go).
 *
 * TODO before this works on a real device:
 *  1. `npx expo prebuild` (or an EAS build) — Expo Go can't load this
 *     native module.
 *  2. iOS: VoIP push requires an Apple Push Notification (VoIP) cert and
 *     PushKit registration; Android needs an FCM sender ID. Neither is
 *     wired up here — without push, incoming calls only ring while the
 *     app happens to be in the foreground with the client already
 *     registered, which is enough for local testing but not production.
 *  3. Call voiceClient.register() once, after fetching a token from
 *     GET /api/voice/token (see api.ts's `voice.getToken`), whenever the
 *     signed-in user's number has destinationType "client".
 */
import { Voice, Call, CallInvite } from "@twilio/voice-react-native-sdk";

type IncomingCallHandler = (callInvite: CallInvite) => void;

class VoiceClientService {
  private voice: Voice | null = null;
  private activeCall: Call | null = null;
  private onIncomingCall: IncomingCallHandler | null = null;

  /** Registers this device to receive calls for the given identity's Access Token. */
  async register(accessToken: string): Promise<void> {
    if (!this.voice) {
      this.voice = new Voice();
      this.voice.on(Voice.Event.CallInvite, (callInvite: CallInvite) => {
        this.onIncomingCall?.(callInvite);
      });
    }
    // TODO: pass a real push registration token once VoIP push (see
    // class-level TODO above) is wired up — without it, this only
    // registers for foreground SDK use, not background/killed-app calls.
    await this.voice.register(accessToken);
  }

  async unregister(): Promise<void> {
    await this.voice?.unregister();
  }

  setIncomingCallHandler(handler: IncomingCallHandler | null) {
    this.onIncomingCall = handler;
  }

  async acceptCall(callInvite: CallInvite): Promise<Call> {
    const call = await callInvite.accept();
    this.activeCall = call;
    return call;
  }

  async rejectCall(callInvite: CallInvite): Promise<void> {
    await callInvite.reject();
  }

  async hangUp(): Promise<void> {
    await this.activeCall?.disconnect();
    this.activeCall = null;
  }
}

export const voiceClient = new VoiceClientService();
