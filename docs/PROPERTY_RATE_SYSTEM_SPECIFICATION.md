   # FUNCTIONAL & TECHNICAL SPECIFICATION
## Two-Way Property Rate Digital Administration & Taxpayer Billing Platform

| Document Attribute | Specification Details |
| :--- | :--- |
| **Target Entity** | Municipal Assembly / Revenue Directorate |
| **Statutory Framework** | Local Government Act, 2016 (Act 936) |
| **Document Version** | Version 1.0 (Production Blueprint) |
| **Reference Sample** | Kpone-Katamanso Municipal Assembly (KKMA) |

---

### 1. Executive Summary

Municipal property rate revenue mobilization currently faces operational friction due to reliance on physical paper notices, manual delivery logistics, and fragmented digital follow-ups. The current notification mechanism broadcasts SMS alerts containing two separate external links: one to view a static copy of the bill and another redirecting to an external payment gateway.

This specification outlines the architecture to replace that fragmented workflow with a unified **Two-Way Digital Property Rate Management Platform**. The platform connects Municipal Revenue Administration (the Client) and Property Owners (the Taxpayers) into a single, cohesive, mobile-first ecosystem.

---

### 2. Baseline Data Structure & Field Identification

The system architecture maps directly to the official statutory Property Rate Demand Notice issued under Act 936. The table below details every verified data element extracted from the operational baseline.

| Category | Field Name | Physical Bill Baseline | Technical Definition & Purpose |
| :--- | :--- | :--- | :--- |
| **Property & Account Identifiers** | Account Number | KKDA03188007 | Unique alphanumeric municipal property account code used for primary indexing and database record linkage. |
| | Digital Address / Owner ID | GK-0010-9395 | GhanaPost GPS digital location identifier; anchors the physical parcel to geographic coordinates. |
| | Property Classification | PRIVATE THIRD CLASS RESIDENTIAL | Zoning and structural category determining the statutory rate-in-the-cedi applied to the property. |
| **Administrative & Zoning Hierarchy** | Township | KPONE TOWNSHIP | Top-level municipal territorial demarcation. |
| | Zonal Council / Sub-Metro | KPONE ZONAL COUNCIL | Intermediate administrative division for decentralized revenue monitoring. |
| | Electoral Area & Street | LAALOI / CHOCOLATE ST | Granular physical location attributes for field officer inspections and address validation. |
| **Billing Timeline & Deadlines** | Bill Year | 2025 | The active fiscal assessment period. |
| | Bill Issue Date | 05-Feb-2025 | Official date of demand notice generation and dispatch. |
| | Settlement Deadline | 30-Jun-2025 | Statutory cutoff date, after which unpaid balances transition to delinquent status subject to civil recovery. |
| **Valuation & Computation** | Rateable Value | GH₵ [Property Valuation] | Certified capital or assessed value of the property asset. |
| | Rate Imposed | 0.00025 | Statutory millage rate / rate-in-the-cedi multiplier applied against the Rateable Value. |
| **Financial Breakdown & Ledger** | Previous Year Bill | GH₵ 300.00 | Total invoiced fee for the preceding assessment year. |
| | Amount Paid (Last Year) | GH₵ 0.00 | Total collections credited against the previous year's assessment. |
| | Arrears | GH₵ 300.00 | Cumulative outstanding debt carried forward from prior fiscal cycles. |
| | Current Fee | GH₵ 150.00 | Assessment levied specifically for the active fiscal year (Rateable Value × Rate Imposed). |
| | Total Amount Due | GH₵ 450.00 | Consolidated payable balance (Arrears + Current Fee). |

---

### 3. Two-Way System Architecture

#### Module A: Taxpayer Mobile Interface (Citizen Portal)

1. **Authentication & Property Association:**
   * Taxpayers access the portal via mobile number verification (SMS OTP).
   * The system automatically queries and binds all property accounts where that telephone number is registered as the designated Account Head.

2. **Native Digital Demand Notice Display:**
   * Replaces static paper images with an interactive, mathematically transparent demand notice.
   * Displays Account Number, Digital Address, Classification, Rate Calculation Formula, and Itemized Ledger in real time.

3. **Integrated Settlement Engine:**
   * Single-click payment interface embedded directly on the bill supporting flexible settlement options:
     * Full Consolidated Balance Settlement (e.g., GH₵ 450.00)
     * Outstanding Arrears Settlement Only (e.g., GH₵ 300.00)
     * Active Fiscal Year Assessment Settlement Only (e.g., GH₵ 150.00)

4. **Payment Channels:**
   * Direct integration with Mobile Money (MTN MoMo, Telecel Cash, AT Money) and Bank Debit Cards.

5. **Instant Digital Certification:**
   * Upon payment confirmation, the system automatically generates an authenticated digital receipt featuring a cryptographically verifiable QR code for presentation during municipal compliance audits.

---

#### Module B: Municipal Administration & Revenue Automation Portal

1. **Annual Batch Billing Engine:**
   * Automated annual job triggered during the opening fiscal window (January/February) that computes the current year's levy across all registered properties:
   $$\text{Current Year Fee} = \text{Rateable Value} \times \text{Rate Imposed}$$
   $$\text{Total Balance Due} = \text{Carried Forward Arrears} + \text{Current Year Fee}$$

2. **Automated SMS Broadcast & Deep-Link Dispatch:**
   * Sends concise notification broadcasts to registered Account Heads containing a secured, single-session token link that opens the taxpayer's specific bill directly within the mobile application.

3. **Real-Time Revenue Monitoring & Defaulter Tracking:**
   * Provides administrative dashboards filtered by Zonal Council, Electoral Area, and Property Classification.
   * Accounts failing to settle by the statutory deadline (June 30) are automatically categorized into actionable compliance queues for civil recovery.

---

### 4. End-to-End Operational Workflow

| Operational Stage | System Action | Responsible Party | Output / Deliverable |
| :--- | :--- | :--- | :--- |
| **1. Annual Rollout** | System runs batch assessment; calculates current fees and rolls uncollected balances into arrears. | Municipal Revenue Directorate | Updated Annual Assessment Ledger |
| **2. Notification Dispatch** | Automated SMS engine broadcasts demand notices with contextual deep-links. | Automated Messaging Pipeline | SMS Delivered to Taxpayer Phone |
| **3. Taxpayer Review** | Taxpayer taps link; views authenticated bill with breakdown of valuation, fee, and arrears. | Property Taxpayer | Verified Digital Demand Notice |
| **4. Payment Processing** | Taxpayer initiates settlement via MoMo/Card; payment gateway processes transaction. | Payment Gateway / Taxpayer | Real-time Payment Webhook Confirmation |
| **5. Reconciliation & Issuance** | Ledger balance updates instantly; digital receipt generated with unique reference and QR verification. | Core Platform Database | Official Municipal Digital Receipt |
| **6. Statutory Enforcement** | Accounts with unpaid balances past June 30 flagged for administrative follow-up. | Revenue Inspection Officers | Defaulter List & Compliance Action |

---

### 5. Financial Computation & Ledger Rules

To prevent accounting discrepancies and guarantee audit compliance, the system implements strict ledger transaction rules:

* **Settlement Allocation Priority:** Payments are applied strictly to the oldest outstanding debt first. Any received amount is credited against **Arrears** before reducing the **Current Year Fee**.
* **Partial Settlement Handling:** If a taxpayer settles GH₵ 200.00 against a total due of GH₵ 450.00 (with GH₵ 300.00 in arrears), the arrears balance updates to GH₵ 100.00, the current fee remains GH₵ 150.00, and the new total due becomes GH₵ 250.00.
* **Immutable Audit Logging:** Every billing transaction, SMS dispatch, bill view, and payment attempt is logged with timestamp, user identifier, and IP address for municipal auditing.

---

PROPERTY RATE DIGITAL ADMINISTRATION PLATFORM — CONFIDENTIAL & PROPRIETARY SPECIFICATION DOCUMENT
