/**
 * Superseded by prisma/schema.prisma + the generated @prisma/client
 * types, now that the database layer is actually wired up (see
 * db/client.ts and the routes under src/routes/). This file is kept
 * only so old imports don't 404 during the transition — prefer
 * `import { User, NineTelNumber, CallRecord, Advertisement } from
 * "@prisma/client"` for anything new.
 */
export type {
  User,
  NineTelNumber,
  CallRecord,
  Advertisement,
  OtpCode,
} from "@prisma/client";
