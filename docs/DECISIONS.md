# ARCHITECTURAL DECISION RECORDS (ADRs)

**Purpose:** The historical log of high-impact engineering decisions for the Municipal Property Tax Collection platform. Every entry reflects pragmatism, scale, and civic responsibility.

---

## ADR-001: Flutter for Cross-Platform Delivery
**Status:** Accepted
**Decision:** We will use Flutter (Dart) to build both the Citizen Ratepayer Mobile App (iOS/Android) and the Client Management & Admin Portal (Web).
**Rationale:** A single unified codebase drastically reduces development overhead for a municipal project. Flutter's rendering engine guarantees a consistent, high-performance UI across all devices, ensuring no citizen is left behind due to hardware fragmentation.

## ADR-002: Offline-First Receipt Archiving
**Status:** Accepted
**Decision:** The application will implement a local database (e.g., Isar or SQLite) to cache digital receipts securely on the device.
**Rationale:** Network reliability cannot be guaranteed. Citizens must be able to present proof of payment to municipal inspectors even when completely offline. This builds trust and resolves dispute issues.

## ADR-003: Adapter Pattern for Mobile Money Gateways
**Status:** Accepted
**Decision:** All payment integrations (Mobile Money, bank transfers) will be abstracted behind a `PaymentGatewayService` interface.
**Rationale:** Payment aggregators and APIs change frequently. By isolating their specific payloads, we prevent vendor lock-in and can seamlessly swap or add new local payment channels without touching the core billing logic.

## ADR-004: Push + SMS Redundancy for Demand Notices
**Status:** Accepted
**Decision:** Demand notices and billing cycles will dispatch via Push Notification first, falling back to SMS if the device is unreachable or the user hasn't installed the app.
**Rationale:** Maximizes reach for revenue mobilization. Push notifications are free, but SMS guarantees delivery to property owners who may not be active app users.

## ADR-005: Civic Premium UI Aesthetics
**Status:** Accepted
**Decision:** The UI will heavily leverage modern aesthetics (vibrant functional colors, glassmorphism hints, dynamic micro-animations) while adhering to strict WCAG accessibility standards.
**Rationale:** A premium, state-of-the-art interface reassures the citizen that their money is being handled by a competent, secure system. High-end design directly correlates with perceived trustworthiness in fintech/civic applications.
