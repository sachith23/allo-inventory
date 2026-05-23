// src/app/page.tsx
import { ProductGrid } from "@/components/ProductGrid";
import { ProductWithStock } from "@/lib/schemas";

async function getProducts(): Promise<ProductWithStock[]> {
  // In production this calls the API; during SSR we can call directly
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const res = await fetch(`${baseUrl}/api/products`, {
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

export default async function HomePage() {
  let products: ProductWithStock[] = [];
  let error = "";

  try {
    products = await getProducts();
  } catch (e) {
    error = "Could not load products. Please refresh.";
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-10 animate-slide-up">
        <p className="text-xs font-mono text-[#4ade80] mb-2 tracking-widest uppercase">
          Live Inventory
        </p>
        <h1 className="text-3xl font-semibold text-white tracking-tight">
          Products
        </h1>
        <p className="text-[--text-muted] mt-1.5 text-sm max-w-xl">
          Stock levels update in real-time. Reserve a product to hold it for 10
          minutes while you complete checkout.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-red-400 text-sm">
          {error}
        </div>
      ) : (
        <ProductGrid initialProducts={products} />
      )}
    </main>
  );
}
