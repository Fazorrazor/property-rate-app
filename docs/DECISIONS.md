# ARCHITECTURAL DECISION RECORDS (ADRs)

**Purpose:** The historical log of high-impact engineering decisions for the Municipal Property Tax Collection platform. Every entry reflects pragmatism, scale, and civic responsibility.

---

## ADR-001: Next.js PWA & Prisma ORM
**Status:** Accepted (Pivoted from Flutter)
**Decision:** We will use Next.js (React/TypeScript) to build a Progressive Web App (PWA) for citizens and the Admin Portal, connecting to the client's existing SQL database via Prisma ORM.
**Rationale:** Next.js eliminates the need for massive local mobile SDK storage (e.g., Android Studio/Xcode) during development. A PWA provides a native app feel ("Add to Home Screen") while allowing us to unify the frontend and backend API logic in a single, lightweight TypeScript repository.

## ADR-002: Offline-First Receipt Archiving via IndexedDB
**Status:** Accepted
**Decision:** The PWA will implement a Service Worker (`next-pwa`) and use the browser's `IndexedDB` to cache digital receipts securely on the device.
**Rationale:** Network reliability cannot be guaranteed. Citizens must be able to present proof of payment to municipal inspectors even when completely offline. This builds trust and resolves dispute issues.

## ADR-003: Adapter Pattern for Mobile Money Gateways
**Status:** Accepted
**Decision:** All payment integrations (Mobile Money, bank transfers) will be abstracted behind a `PaymentGatewayService` interface.
**Rationale:** Payment aggregators and APIs change frequently. By isolating their specific payloads, we prevent vendor lock-in and can seamlessly swap or add new local payment channels without touching the core billing logic.

## ADR-004: Push + SMS Redundancy for Demand Notices
**Status:** Accepted
**Decision:** Demand notices and billing cycles will dispatch via Push Notification first, falling back to SMS if the device is unreachable or the user hasn't installed the app.
**Rationale:** Maximizes reach for revenue mobilization. Push notifications are free, but SMS guarantees delivery to property owners who may not be active app users.

## ADR-005: Material Design 3 (Material You)
**Status:** Accepted
**Decision:** The UI will strictly adhere to Google's Material Design 3 specifications, utilizing Design Tokens, Semantic Color Roles, and Tonal Elevation.
**Rationale:** Material 3 provides a mathematically precise, highly accessible design system. It ensures the interface feels approachable, official, and state-of-the-art, removing bureaucratic clutter and instilling citizen trust.
