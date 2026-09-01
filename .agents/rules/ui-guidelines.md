---
description: Strict UI design constraints and minimalistic styling rules
globs: ["**/*.tsx", "**/*.ts", "**/*.css", "**/*.jsx", "**/*.js"]
always_on: true
---

# UI Design Constraints & Rules

## 1. ABSOLUTELY NO PILLS OR BUBBLES
- **Under NO circumstances should you use pills, capsule badges, colored background chips, or container bubbles around text, counts, logos, buttons, or status indicators.**
- Status and metadata must be rendered using **clean, minimalistic typography** with natural colors (e.g., `<span className="text-xs text-[#717171] font-normal">(4 unread)</span>`, `<span className="text-xs font-medium text-[#137333]">Settled</span>`, or `<span className="text-xs font-medium text-[#C5221F]">Payment Due</span>`).
- Tabs must use clean typographic labels with a minimal underline indicator, never pill/capsule toggle buttons.
- Logos (such as "Heinz") must be rendered directly as typography without enclosing pill/bubble containers.

## 2. GHANAIAN CURRENCY ONLY
- All currency values across the entire system must strictly be Ghanaian Cedi (`GH₵`).
- Never use dollar signs (`$`) in any UI, metadata, receipts, or icons (e.g., use `<ReceiptText>` instead of `<Receipt>`).

## 3. CLEAN ACTION ROWS
- Unpaid property cards use an elongated continuous arrow through the center of "Pay Now" (`───── Pay Now ─────►`) without any background bubble or pill.
- Settled properties omit action buttons entirely.
