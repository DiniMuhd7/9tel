import express from "express";
import dotenv from "dotenv";
import voiceRouter from "./routes/voice";
import authRouter from "./routes/auth";
import numbersRouter from "./routes/numbers";
import callsRouter from "./routes/calls";
import billingRouter, { webhookHandler } from "./routes/billing";
import { requireAuth } from "./middleware/auth";

dotenv.config();

const app = express();

// IMPORTANT: the Stripe webhook needs the RAW request body for signature
// verification (see services/payments/stripe.ts's constructWebhookEvent)
// — it must be mounted with express.raw() BEFORE the app-wide
// express.json() below, or Stripe's signature check fails even for a
// genuinely valid request, since the body would already be
// parsed/re-serialized by the time it got there. This is why webhookHandler
// is a standalone function rather than a route inside billingRouter.
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), webhookHandler);

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Twilio webhooks post form-encoded bodies

/**
 * GET /health — used as Render's health check path (see render.yaml's
 * healthCheckPath). Deliberately does NOT touch the database: Render
 * uses this to decide whether an instance is alive during deploys and
 * restarts, and a DB hiccup shouldn't look identical to "the process
 * itself is dead" — that distinction matters for how Render reacts.
 */
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

// Public — Twilio webhooks aren't user-authenticated (they're validated by
// Twilio request signature instead; see TODO in routes/voice.ts).
app.use("/api/voice", voiceRouter);
app.use("/api/auth", authRouter);

// GET /plans and POST /checkout — /webhook is mounted separately above,
// before express.json(), so it isn't part of this router at all.
app.use("/api/billing", billingRouter);

// Authenticated
app.use("/api/numbers", requireAuth, numbersRouter);
app.use("/api/calls", requireAuth, callsRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`9tel backend listening on :${port}`));
