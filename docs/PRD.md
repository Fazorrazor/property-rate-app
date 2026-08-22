# PRODUCT REQUIREMENTS DOCUMENT (PRD)

**Purpose:** Outlines the core features, business objectives, Non-Functional Requirements (NFRs), and Disaster Recovery protocols for the Municipal Property Tax Collection platform.

---

## 1. Core User Journeys

### The Citizen Ratepayer
**Goal:** View their property tax bill and pay it securely via mobile.
**Journey:**
1. Authenticates (Phone number OTP or National ID).
2. Views dashboard showing linked properties and current tax status.
3. Selects an outstanding bill and taps "Pay Now".
4. Chooses Mobile Money, authorizes the prompt on their phone.
5. Receives instant success animation and a permanently archived Digital Receipt.
6. Can view receipts later, even completely offline.

### The Municipal Admin
**Goal:** Automate billing and track revenue compliance.
**Journey:**
1. Logs into the Cloud Admin Portal (Web).
2. Uploads or syncs the annual property valuation roll.
3. Schedules a mass billing cycle.
4. System automatically dispatches SMS/Push demand notices to all registered owners.
5. Monitors a real-time dashboard showing collected revenue vs. outstanding debts.

---

## 2. Non-Functional Requirements (NFRs) & Service Level Objectives

- **Time to Interactive (TTI):** The Citizen App must launch and display cached data in under 2 seconds.
- **Availability:** 99.9% uptime. The Admin portal must handle large batch processing without timing out.
- **Data Security:** All API communications over TLS 1.3. Local SQLite database must be encrypted.
- **Traceability:** 100% of network logs and database rows must include a specific `transaction_id` for cross-system debugging and audit trails.

---

## 3. Disaster Recovery & Graceful Degradation Matrix

A civic platform must anticipate failure gracefully.

| Failure Point | System Response | User Experience |
| :--- | :--- | :--- |
| **Mobile Money API Down** | Payment initiation fails gracefully. | "Payment network currently unavailable. Please try again in 5 minutes." |
| **Citizen Offline** | App loads from local cache. | Can view archived receipts. "Pay" button disabled with an "Offline" badge. |
| **Backend DB Timeout** | Edge functions log the payload to a queue for retry. | Admin sees a "Processing..." state instead of an error crash. |
| **Webhook Missed** | A backend cron job actively polls the payment provider for pending transactions every 15 mins. | Citizen receives delayed confirmation rather than a lost payment. |

---

## 4. Specific Functional Rules

- **Property Linking:** A citizen must be able to link multiple properties to a single profile using unique Property Identification Numbers (PINs).
- **Partial Payments:** The system must support and track partial tax payments, carrying the balance forward accurately.
- **Receipt Verification:** Every digital receipt must include a verifiable QR code that municipal inspectors can scan in the field to confirm authenticity against the live database.
