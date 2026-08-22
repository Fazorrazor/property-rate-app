# TASKS

**Purpose:** The central roadmap and active checklist for building the Municipal Property Tax Collection platform.

---

## Phase 1: Architecture & Foundation
- [ ] Initialize the Flutter project (structured for multi-platform: Mobile & Web).
- [ ] Set up the state management architecture (Riverpod).
- [ ] Configure the local database for offline storage (Isar/SQLite).
- [ ] Define the routing strategy (GoRouter).
- [ ] Establish the Design System tokens (Colors, Typography, Themes).

## Phase 2: Core Citizen Features (Mobile App)
- [ ] Implement Citizen Authentication (OTP/Phone).
- [ ] Build the Property Dashboard (List of linked properties and statuses).
- [ ] Build the Bill Detail View (Breakdown of taxes owed).
- [ ] Integrate Mobile Money payment flow + Idempotency logic.
- [ ] Build the Digital Receipt Archive (Offline-capable).
- [ ] Implement the verifiable QR Code generator for receipts.

## Phase 3: Core Admin Features (Web Portal)
- [ ] Implement Admin Authentication & RBAC (Role-Based Access Control).
- [ ] Build the Revenue Compliance Dashboard (Charts & Metrics).
- [ ] Build the Property Roll Management module (CRUD operations for properties).
- [ ] Implement the Billing Cycle Scheduler (Batch SMS/Push dispatch).
- [ ] Build the Transaction Audit Log viewer.

## Phase 4: Polish & Production
- [ ] Add Premium UI Micro-animations (Success states, Hero transitions).
- [ ] Conduct accessibility audits (Screen readers, high contrast).
- [ ] Implement robust error handling and network retry queues.
- [ ] Finalize App Store and Google Play configurations.
