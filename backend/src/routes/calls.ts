import { Router, Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { prisma } from "../db/client";

const router = Router();

/** GET /api/calls — call history for the authenticated user, most recent first. */
router.get("/", async (req: AuthedRequest, res: Response) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthenticated" });

  const records = await prisma.callRecord.findMany({
    where: { userId: req.userId },
    orderBy: { startedAt: "desc" },
    take: 100,
  });

  res.json(
    records.map((r) => ({
      id: r.id,
      // Caller-name resolution happens client-side now (mobile matches
      // callerNumber against the device's own contacts — see
      // services/contacts.ts), not here. callerLabel stays equal to the
      // raw number as a fallback for any client that doesn't do that
      // matching (or has no permission/match), so this response is
      // still meaningful on its own.
      callerLabel: r.callerNumber,
      callerNumber: r.callerNumber,
      destinationNumber: r.destinationNumber,
      startedAt: r.startedAt.toISOString(),
      durationSeconds: r.durationSeconds,
      status: r.status,
    }))
  );
});

export default router;
