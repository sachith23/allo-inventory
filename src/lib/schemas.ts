// src/lib/schemas.ts
import { z } from "zod";

export const ReserveSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().int().min(1),
});

export const IdSchema = z.object({
  id: z.string().min(1),
});

export type ReserveInput = z.infer<typeof ReserveSchema>;

// Shape returned from GET /api/products
export type ProductWithStock = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  stockLevels: {
    warehouseId: string;
    warehouseName: string;
    warehouseLocation: string;
    totalUnits: number;
    reserved: number;
    available: number;
  }[];
};

export type ReservationDetail = {
  id: string;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  quantity: number;
  expiresAt: string;
  createdAt: string;
  product: { id: string; name: string; price: number; imageUrl: string | null };
  warehouse: { id: string; name: string; location: string };
};
