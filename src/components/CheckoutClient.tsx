"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ReservationDetail } from "@/lib/schemas";

function useCountdown(expiresAt: string) {
  const getSecondsLeft = () =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));

  const [secondsLeft, setSecondsLeft] = useState(getSecondsLeft);

  useEffect(() => {
    if (secondsLeft === 0) return;
    const id = setInterval(() => {
      const s = getSecondsLeft();
      setSecondsLeft(s);
      if (s === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");

  return { secondsLeft, display: `${mins}:${secs}` };
}

type Status = "PENDING" | "CONFIRMED" | "RELEASED" | "EXPIRED";

export function CheckoutClient({
  reservation: initial,
}: {
  reservation: ReservationDetail;
}) {
  const router = useRouter();
  const [reservation, setReservation] = useState(initial);
  const [status, setStatus] = useState<Status>(initial.status as Status);
  const [loading, setLoading] = useState<"confirm" | "cancel" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const { secondsLeft, display } = useCountdown(reservation.expiresAt);

  // Mark as expired locally once timer hits 0
  useEffect(() => {
    if (secondsLeft === 0 && status === "PENDING") {
      setStatus("EXPIRED");
    }
  }, [secondsLeft, status]);

  const handleConfirm = useCallback(async () => {
    setLoading("confirm");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/confirm`, {
        method: "POST",
        headers: {
          "Idempotency-Key": `confirm-${reservation.id}`,
        },
      });
      const data = await res.json();
      if (res.status === 410) {
        setStatus("EXPIRED");
        setErrorMsg("Your reservation expired before we could confirm it. Please reserve again.");
        return;
      }
      if (!res.ok) {
        setErrorMsg(data.error || "Something went wrong.");
        return;
      }
      setReservation(data);
      setStatus("CONFIRMED");
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }, [reservation.id]);

  const handleCancel = useCallback(async () => {
    setLoading("cancel");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/release`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || "Could not cancel.");
        return;
      }
      setStatus("RELEASED");
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }, [reservation.id]);

  const isUrgent = secondsLeft > 0 && secondsLeft <= 60;
  const total = reservation.product.price * reservation.quantity;

  return (
    <main className="max-w-lg mx-auto px-6 py-10">
      <a
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mb-8"
      >
        ← Back to products
      </a>

      <div className="mb-8 animate-slide-up">
        <p className="text-xs font-mono text-[#4ade80] mb-2 tracking-widest uppercase">
          Checkout
        </p>
        <h1 className="text-2xl font-semibold text-white">Complete your order</h1>
      </div>

      {/* Status Banner */}
      <StatusBanner status={status} />

      {/* Timer — only show when pending */}
      {status === "PENDING" && (
        <div
          className={`mb-6 rounded-2xl border p-5 flex items-center justify-between animate-slide-up ${
            isUrgent
              ? "border-amber-500/30 bg-amber-500/5 countdown-urgent"
              : "border-white/[0.07] bg-[#111]"
          }`}
        >
          <div>
            <p className="text-xs text-white/40 mb-0.5">Time remaining</p>
            <p
              className={`text-3xl font-mono font-medium tracking-widest ${
                isUrgent ? "text-amber-400" : "text-white"
              }`}
            >
              {display}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/30">This hold expires at</p>
            <p className="text-xs font-mono text-white/50 mt-0.5">
              {new Date(reservation.expiresAt).toLocaleTimeString()}
            </p>
          </div>
        </div>
      )}

      {/* Order Summary */}
      <div className="bg-[#111] border border-white/[0.07] rounded-2xl p-5 mb-6 animate-slide-up space-y-4">
        <div className="flex gap-4">
          {reservation.product.imageUrl && (
            <img
              src={reservation.product.imageUrl}
              alt={reservation.product.name}
              className="w-20 h-20 object-cover rounded-xl bg-[#181818] shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-white text-sm leading-snug mb-1">
              {reservation.product.name}
            </h2>
            <p className="text-xs text-white/40">{reservation.warehouse.name}</p>
            <p className="text-xs text-white/30">{reservation.warehouse.location}</p>
          </div>
        </div>

        <div className="border-t border-white/[0.07] pt-4 space-y-2">
          <SummaryRow label="Unit price" value={`₹${reservation.product.price.toLocaleString("en-IN")}`} />
          <SummaryRow label="Quantity" value={`× ${reservation.quantity}`} />
          <div className="border-t border-white/[0.07] pt-2 mt-2">
            <SummaryRow
              label="Total"
              value={`₹${total.toLocaleString("en-IN")}`}
              bold
            />
          </div>
        </div>

        <div className="bg-[#181818] rounded-xl px-3 py-2.5 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
          <p className="text-xs font-mono text-white/30">
            Reservation ID:{" "}
            <span className="text-white/50">{reservation.id}</span>
          </p>
        </div>
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 animate-slide-up">
          {errorMsg}
        </div>
      )}

      {/* Actions */}
      {status === "PENDING" && (
        <div className="flex gap-3 animate-slide-up">
          <button
            onClick={handleCancel}
            disabled={loading !== null}
            className="flex-1 h-12 rounded-xl border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-sm font-medium transition-all disabled:opacity-40"
          >
            {loading === "cancel" ? "Cancelling…" : "Cancel"}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading !== null}
            className="flex-[2] h-12 rounded-xl bg-[#4ade80] text-[#0a0a0a] font-semibold text-sm hover:bg-[#22c55e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === "confirm" ? "Processing…" : `Confirm Purchase · ₹${total.toLocaleString("en-IN")}`}
          </button>
        </div>
      )}

      {(status === "CONFIRMED" || status === "RELEASED" || status === "EXPIRED") && (
        <a
          href="/"
          className="block w-full h-12 rounded-xl bg-[#4ade80] text-[#0a0a0a] font-semibold text-sm hover:bg-[#22c55e] transition-colors text-center leading-[3rem]"
        >
          Back to Products
        </a>
      )}
    </main>
  );
}

function StatusBanner({ status }: { status: Status }) {
  const config = {
    PENDING: null,
    CONFIRMED: {
      bg: "bg-[#4ade80]/10 border-[#4ade80]/20",
      text: "text-[#4ade80]",
      icon: "✓",
      title: "Order confirmed!",
      desc: "Your purchase was successful. The units have been permanently allocated to your order.",
    },
    RELEASED: {
      bg: "bg-white/5 border-white/10",
      text: "text-white/50",
      icon: "○",
      title: "Reservation cancelled",
      desc: "This reservation was cancelled and the units are now available to other shoppers.",
    },
    EXPIRED: {
      bg: "bg-red-500/10 border-red-500/20",
      text: "text-red-400",
      icon: "⏱",
      title: "Reservation expired",
      desc: "The 10-minute hold has passed and units have been released back to stock.",
    },
  };

  const c = config[status];
  if (!c) return null;

  return (
    <div
      className={`mb-6 rounded-2xl border p-5 animate-slide-up ${c.bg}`}
    >
      <div className="flex items-center gap-3">
        <span className={`text-2xl ${c.text}`}>{c.icon}</span>
        <div>
          <p className={`font-semibold text-sm ${c.text}`}>{c.title}</p>
          <p className="text-xs text-white/40 mt-0.5">{c.desc}</p>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${bold ? "text-white/60" : "text-white/40"}`}>
        {label}
      </span>
      <span
        className={`text-sm ${bold ? "text-white font-semibold" : "text-white/70"}`}
      >
        {value}
      </span>
    </div>
  );
}
