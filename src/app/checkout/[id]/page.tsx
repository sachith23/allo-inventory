// src/app/checkout/[id]/page.tsx
import { CheckoutClient } from "@/components/CheckoutClient";
import { ReservationDetail } from "@/lib/schemas";

async function getReservation(id: string): Promise<ReservationDetail | null> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const res = await fetch(`${baseUrl}/api/reservations/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json();
}

export default async function CheckoutPage({
  params,
}: {
  params: { id: string };
}) {
  const reservation = await getReservation(params.id);

  if (!reservation) {
    return (
      <main className="max-w-lg mx-auto px-6 py-20 text-center">
        <p className="text-6xl mb-4">🔍</p>
        <h1 className="text-xl font-semibold text-white mb-2">
          Reservation not found
        </h1>
        <p className="text-white/40 text-sm mb-6">
          This reservation doesn't exist or may have already been completed.
        </p>
        <a
          href="/"
          className="inline-block px-5 py-2.5 rounded-xl bg-[#4ade80] text-[#0a0a0a] font-semibold text-sm hover:bg-[#22c55e] transition-colors"
        >
          Back to Products
        </a>
      </main>
    );
  }

  return <CheckoutClient reservation={reservation} />;
}
