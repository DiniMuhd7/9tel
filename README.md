# 9tel — Skeleton

Monorepo skeleton for **9tel**: virtual number call-forwarding app with
ad-supported free tier and ad-free Premium tier, per the attached concept.

```
9tel/
├── mobile/    Expo React Native + TypeScript app (user-facing)
└── backend/   Node/TypeScript API — call routing, TwiML, billing
```

## Scope implemented (V1, per doc section 14 — all 7 items are real, not stubs)

1. Registration/login — redesigned along the way: Free tier needs no
   registration at all (silent per-device guest session); phone
   verification + profile only happen at Premium/Business upgrade. Real
   OTP (hashed, expiring) + JWT, real SMS delivery via Twilio.
2. 9tel number assignment — real Twilio provisioning (toll-free for
   US/CA/GB, local elsewhere, shared toll-free+extension for Free),
   Business accounts can hold multiple numbers.
3. Destination number verification — real for PSTN-delivery accounts
   (US/CA/GB); replaced with in-app Voice SDK delivery (no phone number
   to verify at all) for everyone else.
4. Incoming call forwarding — real TwiML, real webhook routing,
   minute-cap enforcement, correct call attribution for the shared
   number.
5. Pre-call advertisement for free users — a TwiML `<Say>`/`<Play>`
   step; there's no real ad inventory/marketplace behind it (see caveats
   below).
6. Premium subscription — real Stripe Checkout + webhook, with
   signature verification and a handled checkout-return race condition.
7. Call history — real, DB-backed, with client-side caller-name
   resolution against device contacts.

Not implemented (V2/V3 per doc, and still true): team members/seats,
business hours, call routing, IVR, call analytics, call recording, AI
receptionist, admin dashboard.

## Architecture

Mirrors the doc's diagram: mobile app → REST API → backend → Postgres +
Twilio + Stripe. The backend keeps Twilio behind a `TelephonyProvider`
interface (see `backend/src/services/telephony/`) so the provider can be
swapped later without touching call-handling logic, as recommended in the
doc's "one architectural recommendation."

## Number-type routing (toll-free vs. local)

Twilio only sells toll-free voice numbers in the **US, Canada, and UK**.
`TwilioProvider.provisionNumber()` (`backend/src/services/telephony/`)
encodes this directly:

- **US / CA / GB** → tries toll-free first (checked live via
  `checkNumberAvailability`), since that's the model 9tel's pitch depends
  on — the caller pays nothing to dial in.
- **Everywhere else** (e.g. Nigeria) → falls back to a local number, since
  Twilio doesn't sell toll-free there. A local number is *not* free for
  the caller to dial — for a genuinely toll-free experience in those
  countries you'll need a local telco/CPaaS partner instead of Twilio, as
  discussed for the Nigeria case.

`coverage.ts` holds the supported-country list and rough reference
pricing (not for billing — re-check the live Twilio Pricing API) used by
`TwilioProvider.estimateMonthlyCostUsd()` for cost previews before
provisioning. `NineTelNumber.numberType` (mobile) and
`NineTelNumberRow.number_type` (backend schema) carry this through the
whole stack so the UI can show "Toll-free · free for callers to dial"
only when that's actually true.

## Pricing (USD, sized against US telephony cost)

`PLANS` in `backend/src/services/payments/stripe.ts` was re-priced
against the US toll-free cost model (~$3.73/user/month at 45 min —
number rental + inbound/outbound legs):

- **Free** — $0/month, capped at **15 min/month** (~$1.40 telephony cost
  per user), down from the original 45-min assumption. Even at 15 min,
  pre-call audio-ad revenue doesn't come close to covering telephony cost
  — see the revenue-feasibility discussion. Treat Free as a lead-gen/trial
  tier, not a sustainable standalone product.
- **Premium** — $9.99/month, ~$6.26 margin over the $3.73 cost baseline
  at moderate usage. This is the tier the business actually needs to work.
- **Business** — $29.99/month, fixed — up to `BUSINESS_MAX_NUMBERS`
  (default 3) numbers per account, enforced server-side.

`FREE_TIER_MONTHLY_MINUTES` in `.env.example` is set to `15` to match.

Payment processor: **Stripe** — see the "Billing is now real" section
further down for what changed and why Flutterwave (the original stub)
was dropped in favor of it.

## Shared number + extensions (Free tier)

Free-tier users don't each get a dedicated number — they share one
toll-free number (`SHARED_TOLLFREE_NUMBER` in `.env.example`) and get a
short numeric extension instead. This saves the $2.15/month-per-number
rental cost for every free signup, at the cost of a real UX tradeoff:
callers have to dial the shared number *and then key in the extension*,
rather than just dialing a number that's uniquely the user's.

- `services/telephony/sharedExtension.ts` — extension generation
  (`assignExtension`) and lookup (`resolveExtension`); both are stubs to
  replace with real DB queries.
- `routes/voice.ts` — `/incoming` now branches: calls to the shared
  number get a `<Gather>` prompt (`buildExtensionPromptResponse`) asking
  for the extension; a new `/extension` route resolves the entered digits
  and completes the ad+dial flow exactly like a dedicated number would.
- `routes/numbers.ts` — `POST /provision` branches by `subscriptionTier`:
  `free` gets the shared number + a new extension, `premium`/`business`
  get a real dedicated number via `TwilioProvider.provisionNumber()`. A
  new `POST /upgrade-to-dedicated` route handles moving a user off the
  shared extension when they upgrade.
- Schema: `NineTelNumberRow.extension` is nullable — populated for shared
  rows, null for dedicated numbers. The uniqueness constraint needs to be
  on `(e164, extension)` together, not `e164` alone, since `e164` repeats
  across every free user.
- Mobile: `NineTelNumber.extension` surfaces on the Home screen with a
  "Extension #### · ask callers to enter this after dialing" line and an
  upgrade nudge when set, replacing the plain toll-free display used for
  dedicated numbers.

This isn't wired to Twilio's real `<Gather>` verb parameters beyond the
basics (`numDigits`, `finishOnKey`, `timeout`) — tune those against real
caller testing before launch.

## Database (Prisma + Postgres)

Routes now read/write real data instead of returning stubs. Added:

- `prisma/schema.prisma` — `User`, `NineTelNumber` (extension-aware, see
  above), `CallRecord`, `Advertisement`, and `OtpCode` (used for both
  phone-login OTP and destination-number verification codes). Run
  `npm run prisma:migrate` against a real `DATABASE_URL` to create the
  tables; `postinstall` runs `prisma generate` automatically.
- `src/db/client.ts` — a reused `PrismaClient` singleton.
- `src/services/usage.ts` — `minutesUsedThisMonth` / `hasMinutesRemaining`,
  aggregating `CallRecord.durationSeconds` for the current calendar month
  against each tier's minute cap from `.env`. `routes/voice.ts` checks
  this before dialing and returns a spoken "out of minutes" message if
  the cap's hit.
- `src/middleware/auth.ts` — real JWT verification (`jsonwebtoken`) and
  `issueAuthToken()`; fails loudly if `JWT_SECRET` is unset rather than
  trusting an unverifiable token.
- `routes/auth.ts` — OTP codes are hashed (`bcryptjs`) and stored with a
  10-minute expiry; verify finds-or-creates the user and returns a real
  JWT. The raw code is only ever logged in non-production, as a stand-in
  for actually sending it via SMS (Twilio Verify is a natural fit).
- `routes/numbers.ts` / `routes/voice.ts` — number provisioning,
  destination verification, and call routing now all read/write
  `NineTelNumber` rows. Call attribution for the shared toll-free number
  no longer guesses: the `<Dial>` verb's `action` URL carries the
  resolved `numberId` as a query param, so `/api/voice/status` can credit
  the right user's minutes regardless of whether they're on a dedicated
  or shared number.
- `routes/billing.ts` / `services/payments/stripe.ts` — real Stripe
  Checkout + webhook handling now, replacing the earlier Flutterwave
  stub entirely — see "Billing is now real — Stripe, not a stub" below.
- Fixed a route-mounting bug in `index.ts`: `billingRouter` was being
  mounted at three different prefixes (`/api/billing/plans`,
  `/api/billing/webhook`, `/api/billing`), which meant the router's
  internal `/plans` route was actually being served at
  `/api/billing/plans/plans`. It's mounted once now, with `requireAuth`
  applied per-route inside `billing.ts` only where needed.

## Registration happens after OTP verify

`POST /api/auth/verify` returns `profileComplete: false` for a
brand-new account (created with blank name/email/country at OTP time).
The mobile app checks that flag right after sign-in and routes to
`app/(auth)/complete-profile.tsx` instead of the main app when it's
false; that screen collects name/email/country and calls the new
`PATCH /api/auth/profile` route, then continues into `(tabs)`. Returning
users with `profileComplete: true` skip straight to the app.

The old pre-OTP `register.tsx` screen (which collected those fields
*before* sending an OTP, then never actually submitted them) is removed
— `login.tsx` is now the single entry point for both new and returning
users, since the backend already find-or-creates on verify. The Welcome
screen's "Get Started" button points at `login.tsx` too.

## Billing is now real — Stripe, not a stub

Previously `startCheckout`/`handleWebhook` were Flutterwave-shaped stubs
that threw `Not implemented`. Given everything else in this app had
already settled into a US-first shape (USD pricing, US/CA/GB toll-free +
Voice SDK split, Stripe already flagged repeatedly as "the more natural
fit"), this commits to **Stripe** outright — `services/payments/stripe.ts`
replaces `flutterwave.ts` entirely, and `PLANS` moved there with it.

- **`startCheckout`** creates a real Stripe Checkout Session
  (`mode: "subscription"`) using a Price ID looked up from
  `STRIPE_PRICE_PREMIUM`/`STRIPE_PRICE_BUSINESS` — `userId`/`planId` go
  in both `metadata` (for the `checkout.session.completed` event) and
  `subscription_data.metadata` (so later subscription-lifecycle events,
  like cancellation, still carry them — `checkout.session.completed`'s
  metadata alone doesn't propagate that far). `success_url`/`cancel_url`
  point at `9tel://checkout-callback?...` — the app's own deep-link
  scheme (`app.json`'s `scheme: "9tel"`), not a web page.
- **Webhook signature verification** is now genuinely Stripe's mechanism,
  not adapted from Flutterwave's: an HMAC-SHA256 over the **raw** request
  body plus a timestamp, via `stripe.webhooks.constructEvent()`. This is
  why `routes/billing.ts`'s webhook handling isn't a route inside
  `billingRouter` at all anymore — it's a standalone `webhookHandler`
  function, mounted directly in `index.ts` with `express.raw({ type:
  "application/json" })` **before** the app-wide `express.json()` call.
  Mounting order matters here: if the global JSON parser ran first, the
  body would already be parsed/re-serialized by the time Stripe's
  signature check saw it, and verification would fail even for a
  genuinely valid request.
- **`handleWebhookEvent`** handles two event types:
  `checkout.session.completed` (upgrade the user's tier) and
  `customer.subscription.deleted` (downgrade back to Free on
  cancellation/failed-payment exhaustion). It deliberately does NOT also
  move a canceled user's number back to the shared toll-free number
  automatically — that changes their public-facing number, which
  deserves a real "your Premium number will stop working" notice rather
  than happening silently inside a webhook handler.
- **The checkout-return race condition is handled, not ignored.** Stripe
  redirects back to the app the instant payment completes, but the
  webhook that actually flips `subscriptionTier` in the database can
  land a moment later — genuinely routine, not a hypothetical edge case.
  New `GET /api/auth/me` lets the client refetch its own tier; mobile's
  new `app/checkout-callback.tsx` (the deep-link target) polls it a
  handful of times (~9 seconds total) before calling
  `POST /api/numbers/upgrade-to-dedicated` and declaring success — it
  doesn't just assume the tier changed the instant the redirect fired.

### Everything from the original "still stubbed" list is now resolved

(This section is kept as a marker of how far things came from the
original stub-heavy skeleton — see the "Is V1 done" summary at the very
end of this README for what's genuinely still open.)

## Caller names in call history now resolve against the device's contacts

Previously `callerLabel` was just the raw phone number, always. Real
caller-name resolution has two common approaches, and this picks the
one that actually fits a call-forwarding app better:

- **Device contacts matching** (what's implemented): free, private
  (nothing leaves the device), works for anyone already in the person's
  contacts — which, realistically, covers most calls someone actually
  cares about a name for.
- **CNAM lookup** (Twilio Lookup's caller-name package) — costs money
  per lookup, and is US-only, so it wouldn't even help the Voice-SDK
  (non-US/CA/GB) half of this app's users. Not implemented; noted here
  so the choice reads as deliberate, not overlooked.

`mobile/services/contacts.ts` requests contacts permission (via
`expo-contacts`) the first time the Calls tab is opened — not at app
launch, since it's only actually needed there — caches the result for
the session, and matches by the **last 10 digits** of each number after
stripping formatting. That's a real simplification: it treats
`+15555550123`, `(555) 555-0123`, and `5555550123` as the same number,
which covers the common case well but isn't fully correct for shorter
non-US numbers or cases where the country code is what actually
distinguishes two different numbers. A proper E.164 parser (e.g.
`libphonenumber-js`) would be worth swapping in before launch.

The backend's `callerLabel` field is untouched (still the raw number) —
it's a fallback for any client that doesn't do contact matching, or where
permission was denied or nothing matched, so the API response stays
meaningful on its own either way.


## SMS delivery is now real, not console-logged

OTP login codes and destination-verification codes previously only ever
`console.log`'d in non-production and did nothing otherwise — a real
launch would have shipped silently broken. `services/sms.ts` now sends
both via Twilio's Messaging API:

- `sendSms()` deliberately **throws** rather than swallowing failures —
  both call sites (`routes/auth.ts`'s `/otp`, `routes/numbers.ts`'s
  `PATCH /destination`) handle that explicitly rather than claiming
  success when delivery actually failed:
  - `/otp` returns a `502` with a clear message if the send fails — the
    person isn't told "code sent" for a code that isn't coming.
  - `PATCH /destination` still saves the destination number and OTP
    record even if the SMS fails (there's a real record to retry against),
    but returns `codeSent: false` alongside it. Mobile's Home screen
    checks this and tells the person plainly rather than assuming the
    code is on its way; re-submitting the same number (via "Change phone
    number") triggers another send attempt.
- Dev/non-production still just logs the code to the console (as
  before) rather than burning a real SMS send on every local test run —
  only `NODE_ENV=production` actually calls Twilio.
- `TwilioProvider.ts`'s inline Twilio-client construction was extracted
  into `services/telephony/client.ts` (`getTwilioClient()`), since
  `sms.ts` needed the same client and duplicating that credential-check
  logic in two places would've been an easy way to have it drift.
- New env: `TWILIO_SMS_FROM_NUMBER` — deliberately separate from the
  number(s) 9tel provisions for call forwarding (`SHARED_TOLLFREE_NUMBER`,
  or whatever a Premium user's dedicated number turns out to be), since a
  shared toll-free number may not be SMS/A2P-verified for every
  destination country and shouldn't be assumed to double as an SMS
  sender.

**TODO worth flagging**: Twilio Verify would likely be a better fit than
hand-rolled SMS for the OTP path specifically — it handles delivery
retries and fraud/rate-limiting that this plain-SMS approach doesn't.
Kept as-is here since the app already generates/hashes/verifies its own
codes rather than delegating that to Verify; swapping later is a
`sms.ts`-level change, not a route-level one.

## Twilio number provisioning is now real, not stubbed

`TwilioProvider.provisionNumber()` and `checkNumberAvailability()`
previously just threw `Not implemented`. They now actually call the
Twilio REST API (`twilio` npm package, already a dependency):

- `findAvailableNumber()` (private) searches
  `client.availablePhoneNumbers(country).tollFree/local/mobile.list()`
  for a single voice-capable candidate, returning `null` — not
  throwing — when nothing's available. That distinction matters:
  `provisionNumber()` treats "toll-free unavailable" as an expected
  fallback-to-local case, not an error.
- `purchase()` (private) actually buys the number via
  `client.incomingPhoneNumbers.create()`, and sets its `voiceUrl` to
  `{TWILIO_WEBHOOK_BASE_URL}/api/voice/incoming` — **without this, a
  purchased number would ring nowhere**, since Twilio only calls a
  number's configured voice webhook, not some default route.
- The Twilio client itself is constructed lazily (`getClient()`) and
  fails loudly with a clear message if `TWILIO_ACCOUNT_SID`/
  `TWILIO_AUTH_TOKEN` aren't set, rather than silently no-op-ing.
- A Twilio 404 on the AvailablePhoneNumbers endpoint itself (some
  country/number-type combos aren't offered at all) is treated the same
  as "none in stock right now" — both just return `null` from
  `findAvailableNumber()` rather than surfacing a raw API error up
  through `provisionNumber()`.

This is the point where the app starts costing real money the moment
`POST /api/numbers/provision` runs against a live Twilio account with
real credentials — worth testing against a Twilio trial account first,
not production, given every call here purchases an actual phone number.

## Free tier needs no account — registration only happens at Premium upgrade

This was a deliberate UX change from the earlier design, where every user
had to register/log in before using the app at all. Now:

- **First launch is silent.** `app/index.tsx` is the new root route: on
  cold start it calls `bootstrapGuestSession()` (`AuthContext`), which
  generates/reuses a per-install `deviceId` (`services/deviceId.ts`) and
  calls the new `POST /api/auth/device` — creating (or resuming) a `User`
  row with `deviceId` set and phone/email/name all null. No screen is
  shown for this; the app drops straight into `(tabs)`.
- **The Free-tier number appears automatically.** `(tabs)/index.tsx`'s
  `loadNumber()` now auto-calls `POST /api/numbers/provision` on a 404,
  so a brand-new guest sees their shared toll-free number + extension
  immediately — there's no separate "create your number" step anymore.
- **Registration is deferred to the Premium upgrade moment.**
  `(tabs)/premium.tsx`'s Upgrade button checks `user.phone`; if unset
  (every guest), it routes to `(auth)/login.tsx?intent=upgrade&planId=…`
  instead of starting checkout directly.
- **Linking a phone doesn't create a new account.** `POST /api/auth/verify`
  now checks for a Bearer token belonging to a phone-less guest; if
  present, it LINKS the verified phone to that same user row instead of
  creating a separate one, so the guest's existing number/extension/call
  history carries over untouched. Mobile's `login.tsx` passes its current
  guest token as `linkToken` only when `intent=upgrade`; a plain login
  (Profile tab's "Log in to a Premium account", for restoring an existing
  account on a new device) omits it, so the backend does a normal
  phone-based find-or-create instead.
- **Profile completion resumes checkout automatically.**
  `complete-profile.tsx` now reads `intent`/`planId` through from the
  login step; on submit, if it was an upgrade flow, it calls
  `startCheckout` immediately and lands back on the Premium tab, instead
  of dropping into the general app and making the person tap Upgrade
  again.
- **`POST /api/numbers/provision` and `/upgrade-to-dedicated` now trust
  the server-side `User.subscriptionTier`, not a client-supplied one.**
  The previous version accepted `subscriptionTier` directly in the
  request body — meaning any authenticated caller (including a guest)
  could have requested `"premium"` and received a free dedicated number.
  Both routes now look the user's real tier up from the database first.

### A real tradeoff worth knowing: "sign out" doesn't fully log out a device

`deviceId` persists in local storage independently of the signed-in
session. For a Premium user, the guest-bootstrap `deviceId` and the
phone-linked account are the **same** `User` row — so after "Sign out"
clears the local token, the next app open's guest bootstrap looks that
same `deviceId` up again and logs straight back into the same account.
Sign-out is therefore mainly useful as a step before logging into a
*different* account on the same device, not as a way to fully log out of
it. `(tabs)/profile.tsx` shows a confirmation dialog that says this
plainly rather than implying a full log-out. A true "forget this device"
action would need to also clear/rotate `deviceId` — not implemented, and
worth deciding deliberately (it also unlinks the Free-tier number tied to
that device) rather than bolting on.

## Voice SDK delivery for users outside US/CA/GB

The forwarding/delivery leg (9tel → the person's own phone) now branches
by country, using the SAME split as toll-free support
(`coverage.ts`'s `usesPstnDestination` — deliberately the same set as
`isTollFreeSupported`, since it's the same underlying reason: Twilio's
PSTN termination is cheap for US/CA/GB and often expensive/unpredictable
everywhere else — Nigeria mobile alone was ~$0.235/min per the
revenue-feasibility breakdown, versus $0.013–0.014/min for US/CA/GB).

- **US/CA/GB** (`destinationType: "pstn"`): unchanged — the person sets
  and verifies a real forwarding phone number, dialed via `<Dial>` as
  before.
- **Everywhere else** (`destinationType: "client"`): no phone number is
  collected at all. Calls are delivered via `<Dial><Client>...</Client></Dial>`
  straight into the 9tel app itself, over WebRTC (Twilio Voice SDK) — no
  PSTN dial-out leg, and therefore none of that leg's per-minute cost.

### What decides which mode a user gets

`User.country` — but note this is asked for **separately from full
registration** via a new `PATCH /api/auth/country` route, callable by
guests. This was necessary because of the Free-tier-needs-no-account
design from earlier: a guest still needs *some* country on file before
`POST /api/numbers/provision` can decide toll-free-vs-local AND
PSTN-vs-Client, but full name/email/phone registration is deliberately
deferred to Premium upgrade. Country alone isn't the kind of
identity-revealing step that principle was protecting against, so it's
asked up front — mobile's Home screen shows a one-field country prompt
before the number ever loads, if `user.country` is empty.

`POST /api/numbers/provision` and `/upgrade-to-dedicated` derive
everything (toll-free vs local, PSTN vs Client) from `user.country` and
`user.subscriptionTier` looked up server-side — client requests carry no
`countryCode`/`subscriptionTier` params at all anymore, for the same
"don't trust client-supplied values for billing-relevant decisions"
reason as the tier fix from earlier.

### New pieces

- **Schema**: `DestinationType` enum (`pstn` | `client`),
  `NineTelNumber.destinationType`/`clientIdentity`.
- **`services/telephony/voiceToken.ts`**: `generateVoiceAccessToken()`
  issues a Twilio Voice SDK Access Token; `clientIdentityForUser()`
  derives a stable, non-guessable Client identity from the user id.
- **`GET /api/voice/token`** (authenticated): mobile calls this to
  register the Voice SDK.
- **`TelephonyProvider.buildIncomingCallResponse`**: `destinationE164`
  became a `CallDestination` union (`{ type: "pstn"; e164 }` |
  `{ type: "client"; identity }`), so the same function builds either
  TwiML shape. A `callerNumber` param, when present, is embedded as a
  `<Parameter>` inside `<Client>` so the mobile incoming-call UI can show
  who's actually calling (a Client identity alone carries no caller
  info).
- **Mobile**: `services/voiceClient.ts` wraps
  `@twilio/voice-react-native-sdk`; `context/VoiceCallContext.tsx`
  registers it (only when `destinationType === "client"`) and tracks
  incoming calls; `components/IncomingCallOverlay.tsx` renders a
  full-screen accept/decline UI from the root layout, so it appears over
  any tab. Home screen shows a plain "Ringing in the 9tel app" status
  card instead of the phone-forwarding UI when in Client mode.

### Required native setup — NOT scaffoldable from here

`@twilio/voice-react-native-sdk` has native modules and will **not** run
in Expo Go — this needs `expo prebuild` or an EAS build. Beyond that:

- **iOS**: requires an Apple Push Notification **VoIP** certificate and
  PushKit registration for calls to ring when the app isn't in the
  foreground (added `voip`/`audio` to `UIBackgroundModes` and a
  microphone usage description in `app.json`, but the actual push
  wiring is a TODO in `voiceClient.ts`).
- **Android**: needs an FCM sender ID for the same reason (added
  `RECORD_AUDIO`/`FOREGROUND_SERVICE`/`USE_FULL_SCREEN_INTENT`
  permissions to `app.json`).
- **Backend**: needs a Twilio **API Key/Secret** (different credentials
  from `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` — Access Tokens are
  signed with an API Key) and a **TwiML Application** whose Voice URL
  points at `POST /api/voice/incoming`, so outgoing calls placed from
  the Voice SDK client also route through this backend. All three go in
  `TWILIO_API_KEY_SID`/`TWILIO_API_KEY_SECRET`/`TWILIO_TWIML_APP_SID`.

Without push wired up, Client-mode calls only ring while the app is
already open in the foreground with the client registered — enough for
local testing, not for a real launch.

### Known simplification: country code entry, not a real picker

Home's country prompt is a plain 2-letter text input, not a proper
country picker component or IP/locale-based inference — flagged in code
as a placeholder to replace before shipping.

## Business tier is now really feature-gated, not just a wider price range

Previously `PLANS.business.priceLabel` was `"$19.99–$39.99/month"` — a
range with no actual pricing or capability behind it, and every account
(including Business) was hard-capped at exactly one number in
`routes/numbers.ts`. That's fixed now:

- **Fixed price**: Business is `$29.99/month` — a single Stripe Price ID
  (`STRIPE_PRICE_BUSINESS`), not a range with nothing to check out
  against.
- **The actual differentiator is real**: `PLANS[].maxNumbers` (Free/
  Premium: `1`, Business: `BUSINESS_MAX_NUMBERS`, default `3`) is
  enforced in `POST /api/numbers/provision` — Business accounts can now
  genuinely hold more than one 9tel number, where before the code
  wouldn't allow it regardless of what the pricing page claimed.
- **`GET /api/numbers`** (new) lists every number an account holds —
  `GET /api/numbers/me` still returns just the primary (first-provisioned)
  one, for Free/Premium's single-number case.
- **Per-number destination management, not just per-account.** This
  mattered more than it might sound: `PATCH /api/numbers/destination`
  and `POST /api/numbers/destination/verify` used to always resolve to
  "the" number, which is fine when there's only ever one — but silently
  wrong once an account can hold several, since setting a destination
  would always hit whichever number happened to be first. Both are now
  `/:numberId/destination` and `/:numberId/destination/verify`, each
  scoped to one specific number (each `NineTelNumber` row already had
  its own `destinationE164`/`destinationType`/etc. columns — this was a
  routing gap, not a schema one). The old no-`numberId` paths still work
  exactly as before as back-compat aliases resolving to the primary
  number, so Free/Premium mobile code needed zero changes.
- **Mobile**: new `app/business-numbers.tsx` (pushed from Profile, not a
  tab — the original nav design deliberately caps the app at 4 tabs) —
  lists an account's numbers, shows `N of maxNumbers` used, lets the
  person add more (disabled at the limit) and set/verify each number's
  own destination.

### What's still NOT implemented from Business's original feature list

The original concept doc listed Business as: multiple numbers, multiple
employees, business hours, call routing, IVR, call analytics, team
members — and explicitly called everything except "multiple numbers"
**V2/V3**, not V1 MVP scope. That call stands: only multiple numbers is
real here. Team members/seats, business-hours-based routing, an IVR
builder, and call analytics are genuinely bigger features (a
Team/Membership data model with invites and per-seat permissions alone
is its own project) — flagged as not built, not silently implied by the
higher price tag.

One real limitation worth knowing if multiple numbers get used in
Client-delivery mode (non-US/CA/GB accounts): `clientIdentity` is
per-USER, not per-number — a Business account with several Client-mode
numbers would have all of them ring the same Voice SDK registration,
with no way to tell which business line was actually dialed. Distinct
per-number identities/ringing isn't implemented.

## Is V1 done?

**All 7 items from the original doc's V1 scope now have real
implementations** — nothing left in that list is a stub that throws or
silently no-ops. That said, "V1 feature-complete" and "ready to launch"
aren't the same claim. What's genuinely still open:

**Never run or tested.** Nothing in this codebase has actually been
installed, compiled, or executed — it was built without network access
to run `npm install`, `prisma migrate`, or a real Expo build. Treat it
as a strong, coherent starting point, not verified-working code. Run
the Prisma migration, wire up real env values, and smoke-test the full
call flow against a Twilio trial account before trusting any of it.

**Deliberate simplifications, each flagged where they live:**
- Country entry is a plain 2-letter text field, not a real picker.
- Caller-number matching uses last-10-digits, not a proper E.164 parser.
- Voice SDK has no VoIP push wired up — calls only ring with the app
  already open in the foreground.
- The pre-call "ad" is a generic `<Say>`/`<Play>` — there's no ad
  inventory, targeting, or marketplace behind it, just the TwiML hook
  where one would plug in.
- OTP delivery is hand-rolled SMS, not Twilio Verify.

**Not part of V1 at all (correctly, per the original doc):** admin
dashboard, team members/seats, business hours, call routing, IVR, call
analytics, call recording, AI receptionist.

**Never addressed, because nothing prompted it:** no automated tests,
no rate-limiting/abuse protection (OTP request spam, extension
brute-forcing on the shared number), no CI, no actual deployment/hosting
setup. Worth real attention before this handles real users or real
money — Stripe and Twilio calls here are live-money operations the
moment real credentials go in.

## Deploying the backend to Render

`render.yaml` at the repo root is a Render Blueprint — it defines the
web service and its Postgres database together, so a single "New >
Blueprint" in the Render Dashboard provisions both.

### One-time setup before you deploy

Render can't invent these — have them ready before you start:

- **Twilio**: Account SID + Auth Token (Console home page), an API
  Key/Secret pair (Console > Account > API keys & tokens — different
  from the Auth Token, used for Voice SDK Access Tokens), a TwiML
  Application SID (Console > Voice > TwiML Apps — create one now; you'll
  set its Voice URL *after* the first deploy, once Render assigns a real
  URL), and an SMS-capable number for `TWILIO_SMS_FROM_NUMBER`.
- **Stripe**: a secret key, and two Price IDs (Dashboard > Product
  catalog) for Premium ($9.99/mo) and Business ($29.99/mo) — recurring
  monthly prices, matching `PLANS` in `services/payments/stripe.ts`.
  `STRIPE_WEBHOOK_SECRET` comes later (see below — it doesn't exist
  until you've created the webhook endpoint, which needs the deploy URL
  first).
- **A shared toll-free number** for `SHARED_TOLLFREE_NUMBER` (Free
  tier) — provision this once, manually, via the Twilio Console or API,
  separately from the per-user numbers the app provisions itself.

### Deploying

1. Push this repo to GitHub (see the earlier "Push to GitHub" section of
   this README for the exact commands).
2. In the Render Dashboard: **New > Blueprint**, select the repo. Render
   reads `render.yaml` and shows you everything it's about to create.
3. You'll be prompted for every `sync: false` value in `render.yaml`
   (all the Twilio and Stripe secrets above) — `JWT_SECRET` and
   `DATABASE_URL` are filled in automatically and never shown to you.
4. Click through — Render builds (`npm install && npm run build`), runs
   the pre-deploy command (`npx prisma migrate deploy`, applying the
   schema to the fresh database), then starts the service.

### After the first deploy — two things only Render can tell you

- **The TwiML Application's Voice URL.** Now that Render has assigned a
  real `https://ninetel-backend-xxxx.onrender.com` URL, go back to the
  TwiML App you created in Twilio Console and set its Voice URL to
  `{that URL}/api/voice/incoming`, POST. (Numbers the app provisions
  *itself* don't need this manual step — `TwilioProvider.purchase()`
  already sets each purchased number's voice URL in code, using
  `TWILIO_WEBHOOK_BASE_URL`, which `render.yaml` wires to Render's own
  `RENDER_EXTERNAL_URL` automatically. The TwiML App is the one piece
  that's configured in Twilio's UI, not through the Twilio API this app
  calls.)
- **The Stripe webhook endpoint.** In Stripe Dashboard > Developers >
  Webhooks, add an endpoint at `{that URL}/api/billing/webhook`,
  subscribed to at least `checkout.session.completed` and
  `customer.subscription.deleted`. Stripe then shows you a signing
  secret — set that as `STRIPE_WEBHOOK_SECRET` on the Render service
  (Dashboard > your service > Environment), since it couldn't exist
  before this point.

### Read this before you trust the `free` plan for anything real

`render.yaml` uses Render's `free` compute plan for both the web service
and the database, so you can deploy and test this without spending
anything. That's the right choice for verifying the setup works — it's
the wrong choice the moment Twilio or Stripe webhooks need to reach this
service reliably:

- **Free web services spin down after 15 minutes of no traffic**, and
  take about a minute to spin back up on the next request. A Twilio or
  Stripe webhook arriving while the service is asleep will time out —
  that's a missed call or an unprocessed payment event, not a cosmetic
  slowdown.
- **Free Postgres databases expire 30 days after creation** (14-day
  grace period, then deletion). Fine for a testing window, not for
  anything meant to keep running.

Change `plan: free` to a paid plan (e.g. `plan: starter` for the web
service) in `render.yaml` before this handles real traffic — both
limitations disappear on any paid plan.

### Everything else that was already flagged still applies

This deployment setup makes the app *reachable*; it doesn't change what
was already true about the code itself — see "Is V1 done?" above for
what's still simplified, stubbed, or genuinely untested (nothing in this
codebase has actually been run before now, including this Blueprint —
validate it against your own Render/Twilio/Stripe accounts before
relying on it).

## Mobile dependencies use one Expo SDK release line

`mobile/package.json` is intentionally pinned to **Expo SDK 52**:
`expo@~52.0.46`, `react@18.3.1`, and `react-native@0.76.9`. Its Expo
modules, router, development client, and Jest preset are pinned to the
same SDK 52 release line. Do not combine these React 18 dependencies
with Expo SDK 57 packages: SDK 57's Jest preset requires React 19, so
that mix produces npm's `ERESOLVE` peer-dependency error before Expo can
load the app configuration.

`@twilio/voice-react-native-sdk@2.0.0-preview.2` remains pinned because
the app imports its Voice, Call, and CallInvite APIs. It is separate
from Expo's SDK-managed package set and should be upgraded only after
checking Twilio's release notes and API compatibility.

The Twilio package is deliberately not listed as an Expo config plugin.
Expo autolinks installed React Native native modules during prebuild, and
the explicit Android permissions and iOS VoIP/audio declarations already
live in `app.json`. Keeping an SDK-57-era third-party config plugin in
the SDK 52 config evaluation path can make `expo config --json` fail
before EAS starts the native build.

### What else changed

`expo`, `expo-router`, `react` (18.3.1), `react-native` (0.76.9), and
`typescript` (5.3.3) are pinned to the selected SDK 52 release line.
`react-native-safe-area-context`, `react-native-screens`,
`expo-status-bar`, `expo-contacts`, `@react-native-async-storage/async-storage`,
and `@types/react` are set to reasonable current-generation versions,
but **weren't individually verified against a live install** — nothing
in this codebase has ever actually been run (see "Is V1 done?" above).
Also added `expo-linking` and `expo-constants` as explicit dependencies:
Expo's own docs list both as required alongside `expo-router`, and they
weren't listed before.

### Run this after `npm install`, don't just trust the pins

The repository has separate `backend/` and `mobile/` Node projects; it
does not have a `package.json` at the repository root. Run the Expo and
EAS commands from `mobile/`. For example, after cloning into
`/content/9tel`, running `npm install` from `/content` will look for
`/content/package.json` and fail with `ENOENT` before it ever reads the
mobile dependencies.

```
cd /content/9tel/mobile
npm install
npx expo install --fix
npx eas-cli@latest build --platform android --profile preview --non-interactive --debug
```

The `preview` profile produces an internally distributed Android APK;
its definition is in `mobile/eas.json`.

`expo install --fix` is Expo's own tool for exactly this situation: it
reads whichever `expo` version actually got installed and rewrites
every Expo-managed package in `package.json` to the versions Expo
itself knows are mutually compatible — strictly more reliable than any
hand-typed version pin, including the ones just added here. Treat the
versions in this commit as a strong starting point that gets you past
the immediate install error, not as verified-correct.

**One more thing worth checking before relying on calling:** `2.0.0-preview.2`
is a **preview** release of the Twilio SDK — preview APIs can change
between preview versions, and `mobile/services/voiceClient.ts` was
written against 1.x's `Voice`/`Call`/`CallInvite` API shape. Diff that
file against Twilio's current React Native SDK docs before trusting it;
a preview major-version bump is exactly the kind of change that can
shift method signatures without much warning.
