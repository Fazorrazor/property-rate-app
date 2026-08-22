# DESIGN SYSTEM: Material Design 3 (Material You)

**Purpose:** Serves as the immutable source of truth for the visual language, interaction design, and UI architecture of the Municipal Property Tax platform. The UI is built strictly on Google's Material Design 3 (M3) specifications to ensure mathematical precision, dynamic accessibility, and a premium, organic feel.

---

## 1. Core Architectural Aesthetics

We reject hardcoded pixels and static hex colors. The platform UI is a living, algorithmic system governed by **Design Tokens**.

### 🏛️ The 5 Pillars of M3 Civic Design

1. **Semantic Color Roles (Dynamic Color):**
   - We define a single "Seed Color" (e.g., Civic Navy). The M3 tonal algorithm generates all necessary palettes (Primary, Secondary, Tertiary, Error, Neutral) spanning 0-100% luminance.
   - UI elements are colored using **Roles**, not raw colors. E.g., a "Pay Now" button background uses the `Primary` token, and its text uses the `On-Primary` token to guarantee WCAG 2.1 accessibility.

2. **Tonal Elevation (Depth without harsh shadows):**
   - We do not use dark drop shadows (`z-index` casting) to create depth.
   - Elevation is achieved tonally. As a surface (like a Tax Bill Card or a Modal) rises in elevation (Level 1 to Level 5), its background color dynamically shifts, taking on a subtle tint of the `Primary` color. This creates a softer, integrated UI.

3. **Shape as a Personality (Approachable Geometry):**
   - The UI moves away from sharp, bureaucratic rectangles. We utilize M3 Shape Tokens to make the app feel friendly and trustworthy.
   - **Floating Action Buttons (FABs):** Rounded squares (using the `ShapeFamily.Rounded` token).
   - **Standard Buttons:** Fully rounded pills.
   - **Cards:** Large rounded corners (16dp).

4. **Mathematical State Layers:**
   - Interaction feedback (Hover, Focus, Pressed, Dragged) is handled systematically via State Layers.
   - When a user taps a card, an overlay of the component's `On-` color is applied at a specific opacity (e.g., 12% for Pressed). We never manually define "darker blue on hover."

5. **Adaptive & Responsive by Default:**
   - The UI must fluidly adapt to the viewport.
   - **Mobile (Citizen App):** Bottom Navigation Bar.
   - **Tablet/Web (Admin Portal):** Navigation Rail (collapsible side menu) or full Drawer.
   - Margins and typography scale automatically based on M3 window size classes (Compact, Medium, Expanded).

---

## 2. Token Specifications

### 🎨 Color Tokens (Example Mapping)
All colors must be referenced via `Theme.of(context).colorScheme`.
| M3 Token Role | Usage in App |
| :--- | :--- |
| **`Primary`** | Main active elements (e.g., "Pay Now" FAB). |
| **`On-Primary`** | Text/Icons resting on top of Primary elements (Always White/Light). |
| **`Primary Container`** | Less prominent active elements (e.g., A selected property tab). |
| **`On-Primary Container`** | Text inside the Primary Container. |
| **`Surface`** | The base background of the app. |
| **`Surface Variant`** | Background for Cards and list items. |
| **`Error`** | Overdue notices, failed transactions. |

### 📐 Shape Tokens
| M3 Token | Value | Usage |
| :--- | :--- | :--- |
| **`Shape.ExtraSmall`** | 4dp | Tooltips, Snackbars. |
| **`Shape.Small`** | 8dp | Text Fields, Dropdowns, Chips. |
| **`Shape.Medium`** | 12dp | Small Cards, Dialogs. |
| **`Shape.Large`** | 16dp | Main Property Cards, Bottom Sheets. |
| **`Shape.Full`** | 1000dp | Standard Action Buttons (Pill shape). |

### ✍️ Typography Tokens
- **Font Family:** Roboto (Native M3 default, highly legible).
- **`Display` (Large/Medium/Small):** Only for massive impact (e.g., The total tax owed).
- **`Headline` (Large/Medium/Small):** Screen titles and prominent card headers.
- **`Title` (Large/Medium/Small):** List item titles and section headers.
- **`Label` (Large/Medium/Small):** Button text, small caps context.
- **`Body` (Large/Medium/Small):** Standard reading text, addresses, descriptions.

---

## 3. UI Component Constraints

### Buttons
- **Filled Button:** Reserved for the absolute primary action (e.g., "Submit Payment").
- **Tonal Button:** Secondary actions that need emphasis but shouldn't compete with the primary (e.g., "Download Receipt").
- **Outlined Button:** Medium-emphasis actions (e.g., "View History").
- **Text Button:** Low-emphasis actions (e.g., "Cancel", "Learn More").

### Forms (Text Fields)
- **Style:** M3 **Filled** or **Outlined** Text Fields.
- Inputs must dynamically adjust their border/underline to the `Primary` color when focused, and `Error` color when invalid.
- Label text must smoothly float above the input upon focus.

### Modals & Bottom Sheets
- Must use the M3 Drag Handle at the top center.
- Must respond to swipe-to-dismiss gestures.
- Background scrim must obscure the underlying content to focus attention.
