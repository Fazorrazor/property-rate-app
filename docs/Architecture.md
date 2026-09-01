# ARCHITECTURE

**Purpose:** Defines the structural patterns, technology stack, and deep system architecture for the Municipal Property Tax Collection platform, engineered for absolute financial integrity, cross-platform reach, and citizen trust.

---

## 1. Technology Stack & Infrastructure Topology

- **Frontend Application (Citizen & Admin):** Next.js (React/TypeScript) configured as a Progressive Web App (PWA).
- **Backend Service:** Next.js API Routes (Node.js/TypeScript).
- **Primary Datastore:** Client's Existing SQL Database.
- **ORM & Data Access:** Prisma ORM for direct, type-safe database connections.
- **Local Storage:** IndexedDB (via Service Workers) for offline caching of digital receipts on the mobile device.
- **Communication Adapter:** Mobile Money API integrations + SMS Gateway for demand notices.

---

## 2. The 3-Tier Security & Validation Perimeter

Never trust the client network.
1. **App Perimeter (PWA):** Strong client-side validation. Secure HttpOnly cookies for session management.
2. **API Perimeter:** Strict schema validation (Zod) on Next.js API routes. Rate limiting on the gateway to prevent abuse.
3. **Database Perimeter:** Prisma validates data types before execution. Row-level logic ensures citizens can only query their own property records and receipts.

---

## 3. Asynchronous Payment Workflow & Idempotency

**The Tax Payment Pipeline:**
This is a high-stakes distributed transaction.
1. **Client Request:** Citizen initiates payment with a client-generated UUID (Idempotency Key).
2. **API Route:** Verifies UUID against a cache/database to prevent double-charging.
3. **Gateway Handoff:** Initiates Mobile Money prompt.
4. **Webhook Callback:** The payment provider hits our webhook. The backend updates the database to "Paid" and dispatches a success Push/SMS.
5. **Client Sync:** The app receives the real-time update and securely caches the digital receipt locally.

---

- **Server Components by Default:** Minimize client-side JS by utilizing Next.js React Server Components (RSC) for heavy data fetching and rendering.
- **Offline Service Workers:** The PWA uses `next-pwa` to cache core assets and intercept network requests, enabling offline receipt viewing.
- **Responsive Layouts:** Tailwind CSS dictates fluid layouts. The Admin Portal utilizes wide, multi-column dashboard layouts, while the Citizen App utilizes a focused, single-column mobile view.

---

## 5. Directory Topology (Domain-Driven Design)

Organize by **Feature/Domain**, not by type:
- `src/features/billing/` (Viewing bills, history)
- `src/features/payments/` (Mobile Money integration, idempotency keys)
- `src/features/admin/` (Billing cycle scheduling, compliance tracking)
- `src/lib/` (Prisma DB client, utility functions, design system configs)
