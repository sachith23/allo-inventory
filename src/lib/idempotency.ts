// src/lib/idempotency.ts
import { prisma } from "./prisma";

/**
 * Wraps a handler with idempotency support.
 * If the same Idempotency-Key is seen again within 24 h, the cached response
 * is returned without re-executing the handler.
 */
export async function withIdempotency<T>(
  key: string | null | undefined,
  handler: () => Promise<{ data: T; status: number }>
): Promise<{ data: T; status: number; cached: boolean }> {
  if (!key) {
    const result = await handler();
    return { ...result, cached: false };
  }

  // Check for existing record
  const existing = await prisma.idempotencyRecord.findUnique({
    where: { key },
  });

  if (existing) {
    return {
      data: existing.response as T,
      status: existing.statusCode,
      cached: true,
    };
  }

  // Execute handler
  const result = await handler();

  // Store result (expire after 24 h)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  try {
    await prisma.idempotencyRecord.create({
      data: {
        key,
        response: result.data as object,
        statusCode: result.status,
        expiresAt,
      },
    });
  } catch {
    // Race: another request stored it first — that's fine, result is the same
  }

  return { ...result, cached: false };
}
