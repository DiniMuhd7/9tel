import { Router, Request, Response } from "express";

const router = Router();

/** POST /api/auth/otp — send an OTP code to a phone number. */
router.post("/otp", async (req: Request, res: Response) => {
  const { phone } = req.body;
  // TODO: generate OTP, store hashed+expiring in DB/Redis, send via SMS
  // (Twilio Verify is a natural fit here).
  res.json({ sent: true });
});

/** POST /api/auth/verify — verify OTP and issue a JWT session. */
router.post("/verify", async (req: Request, res: Response) => {
  const { phone, code } = req.body;
  // TODO: verify code, find-or-create user, issue JWT via jsonwebtoken
  // using JWT_SECRET.
  res.json({
    token: "TODO-issue-real-jwt",
    user: { id: "todo", name: "", email: "", phone, country: "", subscriptionTier: "free" },
  });
});

export default router;
