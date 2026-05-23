# Allo Inventory — Take-Home Exercise

A Next.js inventory reservation platform that handles concurrent checkout flows without overselling stock.

**Live URL:** _[fill in after deploy]_  
**GitHub:** _[fill in after push]_

---

## Running locally

### Prerequisites
- Node.js 18+
- A Neon (or other hosted Postgres) connection string
- Git

### Steps

```bash
# 1. Clone and install
git clone <your-repo-url>
cd allo-inventory
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local and fill in DATABASE_URL from your Neon dashboard

# 3. Push the schema and seed the database
npm run db:push     # creates tables from schema.prisma
npm run db:seed     # seeds 5 products, 3 warehouses, 15 stock levels

# 4. Start the dev server
npm run dev
# → http://localhost:3000
```

### Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon/Supabase Postgres connection string (Prisma format) |
| `NEXT_PUBLIC_APP_URL` | Base URL for server-side API calls (default: `http://localhost:3000`) |

---

## How the reservation system works

### The race condition problem

When two customers simultaneously try to reserve the last unit, a naive implementation (read stock → check → update) creates a race:

```
T1: reads available = 1  ✓ enough
T2: reads available = 1  ✓ enough
T1: sets reserved += 1   → reserved = 1
T2: sets reserved += 1   → reserved = 2  ← oversold!
```

### The fix: serializable transactions + SELECT FOR UPDATE

All reservation creation happens inside a **Serializable** PostgreSQL transaction that issues a `SELECT ... FOR UPDATE` on the specific `StockLevel` row:

```sql
SELECT id, "totalUnits", reserved, "productId", "warehouseId"
FROM "StockLevel"
WHERE "productId" = $1 AND "warehouseId" = $2
FOR UPDATE
```

`FOR UPDATE` acquires an exclusive row-level lock. The second concurrent transaction blocks at this line until the first one commits or rolls back. After the first transaction commits (incrementing `reserved`), the second one re-reads the now-updated row and sees `available = 0`, returning a 409.

This means:
- **Exactly one** request succeeds when multiple race for the last unit.
- No distributed lock manager or Redis is required for correctness.
- The lock scope is narrow (single row), so throughput scales per-SKU.

### Data model

```
Product → StockLevel (per warehouse) → tracks totalUnits + reserved
                                               ↑
Reservation ───────────────────────────────────┘
  status: PENDING | CONFIRMED | RELEASED
  expiresAt: DateTime (10 min window)
```

- **`reserved`** = units currently held by PENDING reservations
- **`available`** = `totalUnits - reserved`
- On **confirm**: `totalUnits -= qty` AND `reserved -= qty` (permanent decrement)
- On **release/expire**: only `reserved -= qty` (units return to available pool)

---

## Reservation expiry

### Strategy: lazy cleanup on read

When `GET /api/products` is called, the server scans for any PENDING reservations with `expiresAt < now()` and releases them inside a transaction before responding. This means:

- Stock appears accurate whenever a product listing is viewed.
- No background worker or cron job is needed.
- The trade-off: a reservation technically "holds" stock until the next product page load after expiry. In practice this window is seconds.

### Why not a cron job?

For a Vercel-hosted app, a Vercel Cron job would work well and could be added easily (just a `GET /api/cron/expire` route + a `vercel.json` schedule). I chose lazy cleanup because:

1. It's self-contained — no additional infrastructure.
2. The checkout page uses a client-side countdown that accurately tells the user their hold has expired at the moment it happens.
3. For the read-path (product listings), the lazy release ensures stock counts are correct at query time.

In a higher-throughput production system, I'd add a background worker (e.g. a pg_cron job directly in Postgres, or a Vercel Cron) that runs every minute, so expiry doesn't depend on traffic.

---

## Idempotency (bonus)

The `POST /api/reservations` and `POST /api/reservations/:id/confirm` endpoints support an `Idempotency-Key` header.

**How it works:**

1. The client sends a unique key (e.g. a UUID) in the `Idempotency-Key` header.
2. Before executing, the server checks the `IdempotencyRecord` table for that key.
3. If found: return the cached `response` JSON and `statusCode` immediately, no side effects.
4. If not found: execute the handler, store the result with a 24-hour TTL, return it.
5. Concurrent duplicate requests: if two requests with the same key race, one will get a unique-constraint error on insert and silently discard it — both callers receive the same outcome.

This is implemented in `src/lib/idempotency.ts` using Postgres as the store. Redis would be faster for this (sub-millisecond lookups vs ~2ms Postgres round-trip), but Postgres is sufficient and avoids adding another dependency.

---

## API reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/products` | List products with available stock per warehouse |
| `GET` | `/api/warehouses` | List all warehouses |
| `POST` | `/api/reservations` | Reserve units. Returns `201` on success, `409` if not enough stock |
| `GET` | `/api/reservations/:id` | Get a single reservation |
| `POST` | `/api/reservations/:id/confirm` | Confirm reservation. Returns `410` if expired |
| `POST` | `/api/reservations/:id/release` | Release reservation early |

---

## Trade-offs and what I'd do differently

### What's here
- Concurrency-safe reservations via `SELECT FOR UPDATE` in a serializable transaction
- Lazy expiry that keeps stock counts accurate on product page reads
- Full TypeScript end-to-end with Zod validation
- Idempotency on reservation creation and confirmation
- Live countdown, error surfaces for 409/410, no manual refresh needed on state change

### What I'd add with more time

1. **Auth** — reservations aren't tied to a user session right now. In production you'd attach a `userId` to each reservation and verify ownership before confirming.

2. **Vercel Cron for expiry** — add a `GET /api/cron/expire` route and a `vercel.json` cron schedule so expiry doesn't depend on page views.

3. **Optimistic UI on product listing** — after a reserve, decrement the displayed count locally so the user immediately sees the change before the next full page refresh.

4. **Redis for idempotency** — Upstash Redis would give faster idempotency lookups and a natural TTL mechanism, removing the need to query the `IdempotencyRecord` table.

5. **Quantity validation on confirm** — currently confirm doesn't re-check that `totalUnits` hasn't been manually adjusted between reserve and confirm.

6. **Tests** — concurrency behaviour deserves an integration test that fires parallel requests at `/api/reservations` and asserts exactly one 201 and one 409.
