import { z } from "zod";
export const breakdownRequestSchema = z
  .object({ goal: z.string().trim().min(1).max(4000) })
  .strict();
export const generatedTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    estimatedMinutes: z.number().int().min(1).max(30),
  })
  .strict();
export const breakdownSchema = z
  .object({
    tasks: z.array(generatedTaskSchema).min(1).max(12),
    scopeNote: z.string().max(300),
  })
  .strict();
export type GeneratedTask = z.infer<typeof generatedTaskSchema>;
export type Breakdown = z.infer<typeof breakdownSchema>;
export type AiErrorCode =
  | "INVALID_INPUT"
  | "UNAVAILABLE"
  | "FORBIDDEN"
  | "BUSY"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "INVALID_RESPONSE"
  | "PROVIDER_ERROR"
  | "REFUSED";
export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
