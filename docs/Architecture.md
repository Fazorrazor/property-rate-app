# ARCHITECTURE

**Purpose:** Defines the structural patterns, technology stack, and deep system architecture for the Municipal Property Tax Collection platform, engineered for absolute financial integrity, cross-platform reach, and citizen trust.

---

## 1. Technology Stack & Infrastructure Topology

- **Frontend Application (Citizen & Admin):** Flutter (Dart) compiled to iOS, Android, and Web.
- **State Management:** Riverpod (for predictable, compile-safe dependency injection and state).
- **Primary Datastore:** PostgreSQL (Strictly typed, ACID-compliant for financial records).
- **Backend Service:** Node.js (TypeScript) or Dart Server (e.g., Serverpod/Frog) for API endpoints.
- **Local Storage:** SQLite/Isar for offline caching of digital receipts on the mobile device.
- **Communication Adapter:** Mobile Money API integrations + SMS Gateway for demand notices.

---

## 2. The 3-Tier Security & Validation Perimeter

Never trust the client network.
1. **App Perimeter (Flutter):** Strong client-side validation. Use secure storage (Keychain/Keystore) for session tokens.
2. **API Perimeter:** Strict schema validation on the backend. Rate limiting on the gateway to prevent abuse.
3. **Database Perimeter:** Row Level Security (RLS) ensures citizens can only query their own property records and receipts.

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

## 4. Frontend Strategy (Mechanical Sympathy)

- **Widget Const-ness:** Enforce `const` widgets everywhere to minimize widget tree rebuilds.
- **Isolate Offloading:** Any heavy processing (e.g., generating PDF receipts) must be handed off to a background Isolate.
- **Responsive Layouts:** The UI must adapt fluidly. The Admin Portal will utilize wide, multi-column dashboard layouts, while the Citizen App will use a focused, single-column mobile layout.

---

## 5. Directory Topology (Domain-Driven Design)

Organize by **Feature/Domain**, not by type:
- `lib/features/billing/` (Viewing bills, history)
- `lib/features/payments/` (Mobile Money integration, idempotency keys)
- `lib/features/admin/` (Billing cycle scheduling, compliance tracking)
- `lib/core/` (Network clients, secure storage, design system tokens)
