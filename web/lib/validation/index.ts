import "server-only";
import { z } from "zod";

/**
 * Base validation utilities and common schemas.
 */

// Email validation: strict format
export const emailSchema = z
  .string()
  .email("Invalid email address")
  .toLowerCase()
  .trim()
  .max(255, "Email is too long");

// Token validation: should be a hex string (64 chars)
export const tokenSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/i, "Token must be 64 hexadecimal characters");

// Session token validation
export const sessionTokenSchema = z
  .string()
  .min(32, "Invalid session token")
  .max(256, "Invalid session token");

// Generic ID validation
export const idSchema = z
  .string()
  .min(1, "ID is required")
  .max(255, "ID is too long");

// URL validation
export const urlSchema = z.string().url("Invalid URL");

// Pagination: limit and offset
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Utility function to safely parse and validate data.
 * Returns { success, data, error } tuple.
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: boolean; data?: T; error?: string } {
  const result = schema.safeParse(data);
  return {
    success: result.success,
    data: result.success ? result.data : undefined,
    error: result.success ? undefined : result.error.message,
  };
}
