# Mobile & Desktop Performance Budget & Frame Rate Guardrails

## 1. Performance Target Standards (Mid-Range Mobile Profile)
All metrics must be evaluated on a **production build** (`next build && next start`) with **4x CPU slowdown** (targeting mid-range Android e.g. Mali/Adreno GPUs and older iOS devices) with a 390×844 mobile viewport.

| Interaction / Surface | Metric Target | Rationale |
|---|---|---|
| **Modal / Sheet Open Animation** | **Steady 60 FPS**, max frame <= **16.7ms**, 0 frames > 20ms | Keeps entrance tactile and smooth without visual hitching |
| **Long Tasks During Entrance** | **0 tasks > 50ms** | Guarantees the browser compositor thread is never blocked |
| **Card Body Scroll** | **Steady 60 FPS**, 0 dropped frames | Prevents touch stuttering on touchscreens during ledger review |
| **Interaction to Next Paint (INP)** | **< 200ms** (target: < 100ms) | Instant tactile feedback upon tapping triggers |
| **Time to First Painted Sheet Frame** | **< 100ms** | Frame 1 visual feedback |
| **Cumulative Layout Shift (CLS)** | **0.000** | Strict zero-layout-shift standard |
| **Background React Re-renders** | **0 re-renders** of background list rows | Background table rows and tiles must be isolated with `React.memo` |
| **Lazy Loading & Code Splitting** | **Receipt modal & print routines lazy-loaded** | Keeps initial bundle weight minimal and defers print CSS |

---

## 2. Rendering, Paint & Compositor Rules

1. **Backdrop Blur Gating & Flat Scrim Fallback**:
   - `backdrop-filter: blur(...)` is computationally expensive on mid-range mobile GPUs (Mali-G52, Adreno 6xx).
   - Constrained devices (`navigator.hardwareConcurrency <= 4`, `navigator.deviceMemory <= 4`, or `prefers-reduced-transparency`) must fall back to a clean flat semi-transparent scrim (`bg-black/60`).
   - Under NO circumstances animate the blur filter radius (`blur(0px)` -> `blur(12px)`) or opacity of a blurred surface directly. Fade a flat scrim instead.

2. **Layer Promotion & Cleanup**:
   - Apply `will-change: transform, opacity` strictly while the sheet/modal is in an active animation lifecycle (`onAnimationStart`).
   - Clear `will-change` to `auto` immediately upon animation completion (`onAnimationComplete`) to release GPU texture memory.
   - Never apply `will-change` permanently across static elements.

3. **CSS Containment & Scroll Isolation**:
   - Modal scroll containers must specify `contain: layout paint style` to prevent scroll repaints from invalidating the root document.
   - Enforce `overscroll-behavior: contain`, `-webkit-overflow-scrolling: touch`, and `touch-action: pan-y`.

4. **Zero Gesture Conflict**:
   - Never attach `drag="y"` listeners directly to a container that also houses scrollable content.
   - Isolate drag gestures using Framer Motion's `useDragControls` attached strictly to the mobile grabber handle (`touch-none` and `onPointerDown={(e) => dragControls.start(e)}`), setting `dragListener={false}` on the sheet container.

5. **Eliminate Layout Thrashing in Dialog Lifecycle**:
   - Never call `.focus()` or read layout properties (`offsetHeight`, `getBoundingClientRect`, `scrollTop`) inside a `setTimeout` during active animation trajectories.
   - Focus must occur with `{ preventScroll: true }` after animation completion (`handleAnimationComplete`).

6. **Singleton Formatters**:
   - Instantiate `Intl.NumberFormat` and `Intl.DateTimeFormat` once as module-level singletons in `@/lib/formatters`.
   - Never instantiate new `Intl` or `toLocaleString` formatters inside render loops or list row maps.

---

## 3. Pre-Commit Performance Checklist

- [ ] **Production Build Check**: Tested on `next build && next start` (never development mode).
- [ ] **Throttling Verification**: Tested under 4x CPU slowdown with mobile viewport (390×844).
- [ ] **React Profiler Validation**: Confirmed that opening the modal triggers zero re-renders of background list rows.
- [ ] **Compositor Animation Check**: Confirmed that only `transform` and `opacity` are animated.
- [ ] **Blur Fallback Check**: Verified that low-end hardware receives the performant solid scrim fallback.
- [ ] **Static Print CSS Check**: Verified that `@media print` rules reside in static CSS rather than dynamic runtime `<style jsx global>` mounts.
