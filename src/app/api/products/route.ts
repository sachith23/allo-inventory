// src/app/api/products/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Lazily release expired reservations before responding
    await releaseExpiredReservations();

    const products = await prisma.product.findMany({
      include: {
        stockLevels: {
          include: { warehouse: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const result = products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      imageUrl: p.imageUrl,
      price: p.price,
      stockLevels: p.stockLevels.map((s) => ({
        warehouseId: s.warehouseId,
        warehouseName: s.warehouse.name,
        warehouseLocation: s.warehouse.location,
        totalUnits: s.totalUnits,
        reserved: s.reserved,
        available: Math.max(0, s.totalUnits - s.reserved),
      })),
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/products]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Lazy expiry: release reservations that have passed expiresAt
async function releaseExpiredReservations() {
  const expired = await prisma.reservation.findMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    select: { id: true, productId: true, warehouseId: true, quantity: true },
  });

  if (expired.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const r of expired) {
      await tx.reservation.update({
        where: { id: r.id },
        data: { status: "RELEASED" },
      });
      await tx.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: r.productId,
            warehouseId: r.warehouseId,
          },
        },
        data: { reserved: { decrement: r.quantity } },
      });
    }
  });

  console.log(`[expiry] Released ${expired.length} expired reservation(s)`);
}
