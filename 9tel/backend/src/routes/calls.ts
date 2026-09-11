import { Router, Request, Response } from "express";

const router = Router();

/** GET /api/calls — call history for the authenticated user. */
router.get("/", async (req: Request, res: Response) => {
  // TODO: query call_records table filtered by user id, most recent first.
  res.json([]);
});

export default router;
