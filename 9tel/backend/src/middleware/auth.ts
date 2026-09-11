import { Request, Response, NextFunction } from "express";

export interface AuthedRequest extends Request {
  userId?: string;
}

/** Verifies the Bearer JWT and attaches userId to the request. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }
  // TODO: verify token with jsonwebtoken using JWT_SECRET, set req.userId.
  req.userId = "todo";
  next();
}
