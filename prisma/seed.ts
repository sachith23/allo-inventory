// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean up existing data
  await prisma.reservation.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.stockLevel.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // Create warehouses
  const mumbai = await prisma.warehouse.create({
    data: { id: "wh-mumbai", name: "Mumbai Central", location: "Mumbai, MH" },
  });
  const delhi = await prisma.warehouse.create({
    data: { id: "wh-delhi", name: "Delhi North", location: "Delhi, DL" },
  });
  const bangalore = await prisma.warehouse.create({
    data: {
      id: "wh-bangalore",
      name: "Bangalore Hub",
      location: "Bangalore, KA",
    },
  });

  // Create products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        id: "prod-headphones",
        name: "ProSound ANC Headphones",
        description:
          "Premium noise-cancelling headphones with 40hr battery life.",
        price: 8999,
        imageUrl:
          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80",
      },
    }),
    prisma.product.create({
      data: {
        id: "prod-keyboard",
        name: "MechType Pro Keyboard",
        description:
          "Mechanical keyboard with Cherry MX switches and RGB backlighting.",
        price: 6499,
        imageUrl:
          "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&q=80",
      },
    }),
    prisma.product.create({
      data: {
        id: "prod-monitor",
        name: '4K IPS 27" Monitor',
        description:
          "Ultra-clear 4K IPS panel with 144Hz refresh rate and HDR support.",
        price: 32999,
        imageUrl:
          "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&q=80",
      },
    }),
    prisma.product.create({
      data: {
        id: "prod-mouse",
        name: "ErgoPro Wireless Mouse",
        description: "Ergonomic wireless mouse with 6-month battery life.",
        price: 2799,
        imageUrl:
          "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&q=80",
      },
    }),
    prisma.product.create({
      data: {
        id: "prod-webcam",
        name: "StreamCam 4K Webcam",
        description: "4K webcam with built-in ring light and AI framing.",
        price: 5499,
        imageUrl:
          "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80",
      },
    }),
  ]);

  // Stock levels: some deliberately scarce to demonstrate concurrency features
  const stockData = [
    // Headphones
    { productId: "prod-headphones", warehouseId: "wh-mumbai", totalUnits: 12 },
    { productId: "prod-headphones", warehouseId: "wh-delhi", totalUnits: 1 }, // scarce!
    { productId: "prod-headphones", warehouseId: "wh-bangalore", totalUnits: 8 },
    // Keyboard
    { productId: "prod-keyboard", warehouseId: "wh-mumbai", totalUnits: 0 }, // out of stock
    { productId: "prod-keyboard", warehouseId: "wh-delhi", totalUnits: 5 },
    { productId: "prod-keyboard", warehouseId: "wh-bangalore", totalUnits: 3 },
    // Monitor
    { productId: "prod-monitor", warehouseId: "wh-mumbai", totalUnits: 2 },
    { productId: "prod-monitor", warehouseId: "wh-delhi", totalUnits: 1 }, // scarce!
    { productId: "prod-monitor", warehouseId: "wh-bangalore", totalUnits: 4 },
    // Mouse
    { productId: "prod-mouse", warehouseId: "wh-mumbai", totalUnits: 20 },
    { productId: "prod-mouse", warehouseId: "wh-delhi", totalUnits: 15 },
    { productId: "prod-mouse", warehouseId: "wh-bangalore", totalUnits: 0 }, // out of stock
    // Webcam
    { productId: "prod-webcam", warehouseId: "wh-mumbai", totalUnits: 1 }, // scarce!
    { productId: "prod-webcam", warehouseId: "wh-delhi", totalUnits: 7 },
    { productId: "prod-webcam", warehouseId: "wh-bangalore", totalUnits: 3 },
  ];

  await Promise.all(
    stockData.map((s) =>
      prisma.stockLevel.create({ data: { ...s, reserved: 0 } })
    )
  );

  console.log(
    `✅ Seeded ${products.length} products, 3 warehouses, ${stockData.length} stock levels`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
