import express from "express";
import dotenv from "dotenv";
import voiceRouter from "./routes/voice";
import authRouter from "./routes/auth";
import numbersRouter from "./routes/numbers";
import callsRouter from "./routes/calls";
import billingRouter from "./routes/billing";
import { requireAuth } from "./middleware/auth";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Twilio webhooks post form-encoded bodies

// Public
app.use("/api/voice", voiceRouter); // Twilio webhooks — not user-authenticated
app.use("/api/auth", authRouter);
app.use("/api/billing/plans", billingRouter); // plan list is public
app.use("/api/billing/webhook", billingRouter); // Flutterwave-authenticated, not JWT

// Authenticated
app.use("/api/numbers", requireAuth, numbersRouter);
app.use("/api/calls", requireAuth, callsRouter);
app.use("/api/billing", requireAuth, billingRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`9tel backend listening on :${port}`));
