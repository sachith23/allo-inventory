// src/app/api/reservations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReserveSchema } from "@/lib/schemas";
import { withIdempotency } from "@/lib/idempotency";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ReserveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const idempotencyKey = req.headers.get("Idempotency-Key");
    const { productId, warehouseId, quantity } = parsed.data;

    const { data, status } = await withIdempotency(idempotencyKey, async () => {
      const result = await createReservation(productId, warehouseId, quantity);
      return result;
    });

    return NextResponse.json(data, { status });
  } catch (err) {
    console.error("[POST /api/reservations]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function createReservation(
  productId: string,
  warehouseId: string,
  quantity: number
): Promise<{ data: object; status: number }> {
  /**
   * CONCURRENCY SAFETY:
   * We use a serializable transaction with SELECT ... FOR UPDATE on the
   * StockLevel row. This means only one concurrent transaction can hold the
   * lock at a time. The second concurrent request waits, then re-reads the
   * (now-updated) reserved count and correctly returns 409 if stock is gone.
   */
  try {
    const reservation = await prisma.$transaction(
      async (tx) => {
        // Lock the specific stock row to prevent concurrent over-reservation
        const stockRows = await tx.$queryRaw<
          Array<{
            id: string;
            totalUnits: number;
            reserved: number;
            productId: string;
            warehouseId: string;
          }>
        >`
          SELECT id, "totalUnits", reserved, "productId", "warehouseId"
          FROM "StockLevel"
          WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
          FOR UPDATE
        `;

        if (stockRows.length === 0) {
          throw new StockError("Stock record not found", 404);
        }

        const stock = stockRows[0];
        const available = stock.totalUnits - stock.reserved;

        if (available < quantity) {
          throw new StockError(
            `Only ${available} unit(s) available (${quantity} requested)`,
            409
          );
        }

        // Increment reserved count
        await tx.stockLevel.update({
          where: {
            productId_warehouseId: { productId, warehouseId },
          },
          data: { reserved: { increment: quantity } },
        });

        // Create the reservation (expires in 10 minutes)
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const res = await tx.reservation.create({
          data: { productId, warehouseId, quantity, expiresAt, status: "PENDING" },
          include: {
            product: { select: { id: true, name: true, price: true, imageUrl: true } },
            warehouse: { select: { id: true, name: true, location: true } },
          },
        });

        return res;
      },
      {
        // Serializable isolation guarantees no phantom reads under concurrency
        isolationLevel: "Serializable",
        timeout: 10_000,
      }
    );

    return {
      data: formatReservation(reservation),
      status: 201,
    };
  } catch (err) {
    if (err instanceof StockError) {
      return { data: { error: err.message }, status: err.statusCode };
    }
    throw err;
  }
}

class StockError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
  }
}

function formatReservation(r: any) {
  return {
    id: r.id,
    status: r.status,
    quantity: r.quantity,
    expiresAt: r.expiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    product: r.product,
    warehouse: r.warehouse,
  };
}
