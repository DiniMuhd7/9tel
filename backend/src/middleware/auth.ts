import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthedRequest extends Request {
  userId?: string;
}

interface AuthTokenPayload {
  sub: string; // userId
}

/** Verifies the Bearer JWT and attaches userId to the request. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = header.slice("Bearer ".length);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fail loudly in any environment rather than silently trusting
    // unverified tokens if the secret is misconfigured.
    return res.status(500).json({ error: "Server auth misconfigured" });
  }

  try {
    const payload = jwt.verify(token, secret) as AuthTokenPayload;
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function issueAuthToken(userId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign({ sub: userId } as AuthTokenPayload, secret, { expiresIn: "30d" });
}
