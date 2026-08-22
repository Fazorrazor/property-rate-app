# SCREENS & UI BLUEPRINT

**Purpose:** This document maps out all distinct screens, user flows, and routing for both the Citizen Ratepayer Mobile App and the Client Management Admin Portal. It serves as the checklist and structural guide for frontend development in Flutter.

---

## 📱 Part 1: Citizen Ratepayer App (Mobile)

The mobile experience must be frictionless, loading instantly and functioning seamlessly even on low-end devices or spotty network connections.

### 1. Welcome, Onboarding & Authentication
* **Route:** `/welcome`
  * **Purpose:** Initial landing screen establishing trust, official municipal branding, and language selection.
  * **UI Elements:** Municipal crest/logo, "Welcome to [Municipality] Property Portal", Language Dropdown, "Continue" button.
* **Route:** `/onboarding`
  * **Purpose:** Educate the user on the app's value (Instant Payments, Permanent Receipts).
  * **UI Elements:** Swipeable carousel, "Get Started" button.
* **Route:** `/auth/login`
  * **Purpose:** Securely log the citizen in.
  * **UI Elements:** Phone number input field, "Send OTP" button.
* **Route:** `/auth/verify`
  * **Purpose:** Verify the OTP.
  * **UI Elements:** 4-6 digit numeric keypad input, automatic submission on complete entry.

### 2. Primary Navigation (Bottom Tab Bar)
The app utilizes a simple bottom navigation bar with 3 tabs: **Dashboard**, **Properties**, **Receipts**.

### 3. Dashboard (Home)
* **Route:** `/dashboard`
  * **Purpose:** At-a-glance financial summary.
  * **UI Elements:** 
    * Top greeting and notification bell.
    * Large `Civic Navy` card showing "Total Outstanding Balance".
    * Prominent `Trust Blue` "Pay Now" floating action button (FAB).
    * List of "Recent Activity" or "Demand Notices".

### 4. Property Management
* **Route:** `/properties`
  * **Purpose:** View all properties linked to this citizen.
  * **UI Elements:** List of cards. Each card shows Property ID, Address, and a status badge (Paid / Overdue).
* **Route:** `/properties/:id`
  * **Purpose:** Detailed breakdown of a specific property.
  * **UI Elements:** Property valuation metrics, historical tax graph, and an itemized current bill.

### 5. Payment Flow (The Critical Path)
* **Route:** `/checkout/:propertyId`
  * **Purpose:** Facilitate frictionless payment.
  * **UI Elements:** 
    * Summary of amount owed.
    * Selector for Payment Method (MTN Mobile Money, Vodafone Cash, AirtelTigo).
    * "Confirm & Pay" button (Triggers secure API call with Idempotency Key).
* **Route:** `/checkout/success`
  * **Purpose:** Instant reassurance and trust building.
  * **UI Elements:** Delightful `Success Emerald` micro-animation (e.g., drawing a checkmark), "View Digital Receipt" button.

### 6. Digital Receipt Archive (Offline First)
* **Route:** `/receipts`
  * **Purpose:** Permanent archive of tax compliance.
  * **UI Elements:** Chronological list of receipts. Must display a "Available Offline" indicator.
* **Route:** `/receipts/:transactionId`
  * **Purpose:** The official proof of payment.
  * **UI Elements:** Municipal logo, timestamp, amount paid, and a **Verifiable QR Code** for field inspectors.

---

## 💻 Part 2: Client Management & Admin Portal (Web)

The admin portal is a data-dense, wide-screen dashboard designed for high-efficiency municipal operations.

### 1. Admin Authentication
* **Route:** `/admin/login`
  * **Purpose:** Secure gateway for municipal staff.
  * **UI Elements:** Email, Password, and mandatory 2FA token input.

### 2. Global Dashboard
* **Route:** `/admin/dashboard`
  * **Purpose:** Real-time revenue command center.
  * **UI Elements:** 
    * Top KPI cards (Total Revenue Collected, Compliance Rate %, Outstanding Debt).
    * Interactive line charts showing payment trends.
    * Live feed of incoming transactions.

### 3. Property Roll Management
* **Route:** `/admin/properties`
  * **Purpose:** Manage the municipality's master list of properties.
  * **UI Elements:** 
    * High-performance data table with global search, filtering (by zone/ward), and pagination.
    * "Import Valuation Roll (CSV)" button.
* **Route:** `/admin/properties/:id`
  * **Purpose:** Deep dive into a specific property.
  * **UI Elements:** Ownership details, full billing history, and an override action to "Manually Record Cash Payment".

### 4. Billing Cycles & Automation
* **Route:** `/admin/billing`
  * **Purpose:** Automate the mass generation of tax bills.
  * **UI Elements:** 
    * "Initialize New Tax Year" wizard.
    * Progress bars showing the automated dispatch of Push/SMS demand notices.

### 5. Transactions & Audit Log
* **Route:** `/admin/transactions`
  * **Purpose:** The unalterable financial ledger.
  * **UI Elements:** 
    * Data table tracking every single payment attempt.
    * Columns for `Transaction UUID`, `Status (Success/Failed)`, `Provider`, and `Timestamp`.

### 6. Communications & Demand Notices
* **Route:** `/admin/communications`
  * **Purpose:** Targeted revenue mobilization.
  * **UI Elements:** 
    * Filter builder (e.g., "Select all properties Overdue > 90 days").
    * Text area to draft a custom SMS reminder.
    * "Dispatch to X Citizens" action button.
