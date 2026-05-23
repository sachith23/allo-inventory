"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProductWithStock } from "@/lib/schemas";

export function ProductGrid({
  initialProducts,
}: {
  initialProducts: ProductWithStock[];
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [modal, setModal] = useState<{
    product: ProductWithStock;
    warehouseId: string;
    warehouseName: string;
    available: number;
  } | null>(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleReserve() {
    if (!modal) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `${modal.product.id}-${modal.warehouseId}-${Date.now()}`,
        },
        body: JSON.stringify({
          productId: modal.product.id,
          warehouseId: modal.warehouseId,
          quantity: qty,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Reservation failed");
        return;
      }

      setModal(null);
      router.push(`/checkout/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product, i) => (
          <ProductCard
            key={product.id}
            product={product}
            index={i}
            onReserve={(warehouseId, warehouseName, available) => {
              setModal({ product, warehouseId, warehouseName, available });
              setQty(1);
              setError("");
            }}
          />
        ))}
      </div>

      {/* Reserve Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={(e) => e.target === e.currentTarget && setModal(null)}
        >
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-sm animate-slide-up">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-xs font-mono text-[#4ade80] mb-1">Reserve</p>
                <h2 className="text-lg font-semibold text-white leading-tight">
                  {modal.product.name}
                </h2>
                <p className="text-xs text-white/40 mt-0.5">{modal.warehouseName}</p>
              </div>
              <button
                onClick={() => setModal(null)}
                className="text-white/30 hover:text-white/60 transition-colors text-xl leading-none mt-0.5"
              >
                ×
              </button>
            </div>

            <div className="bg-[#181818] rounded-xl p-4 mb-4 space-y-2.5">
              <Row label="Price" value={`₹${modal.product.price.toLocaleString("en-IN")}`} />
              <Row label="Available" value={`${modal.available} unit${modal.available !== 1 ? "s" : ""}`} />
              <Row label="Hold duration" value="10 minutes" accent />
            </div>

            <div className="mb-4">
              <label className="text-xs text-white/50 mb-1.5 block">Quantity</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all flex items-center justify-center"
                >
                  −
                </button>
                <span className="text-lg font-semibold text-white w-6 text-center">
                  {qty}
                </span>
                <button
                  onClick={() => setQty((q) => Math.min(modal.available, q + 1))}
                  className="w-9 h-9 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-xs text-red-400">
                {error}
              </div>
            )}

            <button
              onClick={handleReserve}
              disabled={loading}
              className="w-full h-11 rounded-xl bg-[#4ade80] text-[#0a0a0a] font-semibold text-sm hover:bg-[#22c55e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Reserving…" : "Reserve Now"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/40">{label}</span>
      <span
        className={`text-xs font-medium ${accent ? "text-[#4ade80]" : "text-white/80"}`}
      >
        {value}
      </span>
    </div>
  );
}

function ProductCard({
  product,
  index,
  onReserve,
}: {
  product: ProductWithStock;
  index: number;
  onReserve: (wId: string, wName: string, available: number) => void;
}) {
  const totalAvailable = product.stockLevels.reduce((s, l) => s + l.available, 0);

  return (
    <div
      className="group bg-[#111] border border-white/[0.07] rounded-2xl overflow-hidden hover:border-white/[0.14] transition-all duration-200 animate-slide-up flex flex-col"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: "both" }}
    >
      {product.imageUrl && (
        <div className="aspect-[16/9] overflow-hidden bg-[#181818]">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      )}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-white text-sm leading-snug pr-2">
            {product.name}
          </h3>
          <span className="text-sm font-semibold text-white/80 shrink-0">
            ₹{product.price.toLocaleString("en-IN")}
          </span>
        </div>

        {product.description && (
          <p className="text-xs text-white/40 mb-4 leading-relaxed">
            {product.description}
          </p>
        )}

        <div className="space-y-2 mb-4 mt-auto">
          {product.stockLevels.map((s) => (
            <div key={s.warehouseId} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    s.available > 3
                      ? "bg-[#4ade80]"
                      : s.available > 0
                      ? "bg-amber-400"
                      : "bg-red-500"
                  }`}
                />
                <span className="text-xs text-white/50">{s.warehouseName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/30 font-mono">
                  {s.available > 0 ? `${s.available} avail.` : "Out of stock"}
                </span>
                {s.available > 0 && (
                  <button
                    onClick={() => onReserve(s.warehouseId, s.warehouseName, s.available)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-[#4ade80] hover:text-[#0a0a0a] text-white/60 hover:text-[#0a0a0a] transition-all font-medium"
                  >
                    Reserve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {totalAvailable === 0 && (
          <div className="text-xs text-red-400/70 font-medium pt-2 border-t border-white/5">
            Out of stock at all warehouses
          </div>
        )}
      </div>
    </div>
  );
}
