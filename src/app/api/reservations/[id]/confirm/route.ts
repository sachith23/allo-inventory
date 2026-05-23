// src/app/api/reservations/[id]/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withIdempotency } from "@/lib/idempotency";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const idempotencyKey = req.headers.get("Idempotency-Key");

  try {
    const { data, status } = await withIdempotency<Record<string, unknown>>(
      idempotencyKey,
      async () => {
        const reservation = await prisma.reservation.findUnique({
          where: { id },
          include: {
            product: { select: { id: true, name: true, price: true, imageUrl: true } },
            warehouse: { select: { id: true, name: true, location: true } },
          },
        });

        if (!reservation) {
          return { data: { error: "Reservation not found" }, status: 404 };
        }

        if (reservation.status === "CONFIRMED") {
          return {
            data: formatReservation(reservation),
            status: 200,
          };
        }

        if (reservation.status === "RELEASED") {
          return {
            data: { error: "Reservation has already been released" },
            status: 409,
          };
        }

        // Check expiry
        if (new Date() > reservation.expiresAt) {
          // Release the hold since it expired
          await prisma.$transaction(async (tx) => {
            await tx.reservation.update({
              where: { id },
              data: { status: "RELEASED" },
            });
            await tx.stockLevel.update({
              where: {
                productId_warehouseId: {
                  productId: reservation.productId,
                  warehouseId: reservation.warehouseId,
                },
              },
              data: { reserved: { decrement: reservation.quantity } },
            });
          });

          return {
            data: { error: "Reservation has expired and units have been released" },
            status: 410,
          };
        }

        // Confirm: decrement totalUnits permanently, release the reserved hold
        const confirmed = await prisma.$transaction(async (tx) => {
          const updated = await tx.reservation.update({
            where: { id },
            data: { status: "CONFIRMED" },
            include: {
              product: { select: { id: true, name: true, price: true, imageUrl: true } },
              warehouse: { select: { id: true, name: true, location: true } },
            },
          });

          await tx.stockLevel.update({
            where: {
              productId_warehouseId: {
                productId: reservation.productId,
                warehouseId: reservation.warehouseId,
              },
            },
            data: {
              totalUnits: { decrement: reservation.quantity },
              reserved: { decrement: reservation.quantity },
            },
          });

          return updated;
        });

        return { data: formatReservation(confirmed), status: 200 };
      }
    );

    return NextResponse.json(data, { status });
  } catch (err) {
    console.error("[POST /api/reservations/:id/confirm]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
