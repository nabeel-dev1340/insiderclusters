import "server-only";
import { z } from "zod";
import { emailSchema, tokenSchema } from "./index";

/**
 * Auth endpoint request/response schemas
 */

// POST /api/auth/request-link
export const requestLinkSchema = z.object({
  email: emailSchema,
});

export type RequestLinkPayload = z.infer<typeof requestLinkSchema>;

// POST /api/auth/verify
export const verifyTokenSchema = z.object({
  token: tokenSchema,
});

export type VerifyTokenPayload = z.infer<typeof verifyTokenSchema>;

// POST /api/auth/logout (no body required)
export const logoutSchema = z.object({}).strict();

export type LogoutPayload = z.infer<typeof logoutSchema>;
