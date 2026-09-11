# 9tel — Skeleton

Monorepo skeleton for **9tel**: virtual number call-forwarding app with
ad-supported free tier and ad-free Premium tier, per the attached concept.

```
9tel/
├── mobile/    Expo React Native + TypeScript app (user-facing)
└── backend/   Node/TypeScript API — call routing, TwiML, billing
```

## Scope implemented in this skeleton (V1, per doc section 14)

1. Registration/login (screens + stubbed OTP/JWT service)
2. 9tel number assignment (dashboard display)
3. Destination number verification (edit-number flow)
4. Incoming call forwarding (`/api/voice/incoming` route + TwiML builder)
5. Pre-call advertisement for free users (ad step in TwiML flow)
6. Premium subscription (screen + Flutterwave service stub)
7. Call history (screen + route)

Not implemented yet (V2/V3 per doc): IVR, multiple numbers, business
accounts, call recording, AI receptionist, admin dashboard, analytics.

## Architecture

Mirrors the doc's diagram: mobile app → REST API → backend → Postgres +
Twilio + Flutterwave. The backend keeps Twilio behind a `TelephonyProvider`
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

`PLANS` in `backend/src/services/payments/flutterwave.ts` was re-priced
against the US toll-free cost model (~$3.73/user/month at 45 min —
number rental + inbound/outbound legs):

- **Free** — $0/month, capped at **15 min/month** (~$1.40 telephony cost
  per user), down from the original 45-min assumption. Even at 15 min,
  pre-call audio-ad revenue doesn't come close to covering telephony cost
  — see the revenue-feasibility discussion. Treat Free as a lead-gen/trial
  tier, not a sustainable standalone product.
- **Premium** — $9.99/month, ~$6.26 margin over the $3.73 cost baseline
  at moderate usage. This is the tier the business actually needs to work.
- **Business** — $19.99–$39.99/month (range, not yet split into fixed
  tiers — needs real feature-gating before launch).

`FREE_TIER_MONTHLY_MINUTES` in `.env.example` is set to `15` to match.

Payment processor: stubbed as Flutterwave in the file name/comments, but
Flutterwave is Africa-first — for a US-first launch, Stripe is the more
standard fit (tax handling, ACH, ⁠subscription lifecycle tooling). Worth
deciding before wiring up real billing calls; the `startCheckout`/
`handleWebhook` interface is written to be processor-agnostic.
