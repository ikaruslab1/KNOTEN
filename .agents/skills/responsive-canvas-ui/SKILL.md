---
name: responsive-canvas-ui
description: Best practices, layout rules, and architectural patterns for responsive node-based canvas web applications (React Flow, node graphs, diagramming tools) across mobile, tablet, and desktop devices.
when-to-use: When designing, adapting, or debugging mobile and tablet responsive layouts for node graphs, infinite canvases, floating toolbars, and touch interactions.
user-invocable: true
effort: medium
---

# Responsive Canvas & Node UI Skill

This skill provides guidelines and patterns for building and optimizing node-based infinite canvas web applications (such as React Flow, visual coding tools, and diagramming editors) across mobile, tablet, and desktop viewports.

---

## 1. The Mobile Canvas Dilemma

Infinite canvases require maximum screen real estate. On mobile devices (360px–430px wide):
- Standard desktop top-left navigation + top-center floating toolbars **collide and occlude up to 50% of the screen**.
- Touch gestures (pinch-to-zoom, two-finger pan, node tap & drag) can easily conflict with fixed overlays.
- Virtual keyboards consume vertical height when typing.

```
┌─────────────────────────────────────────────────────────────┐
│ MOBILE CANVAS ARCHITECTURE                                  │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│  [Top Layer: Collapsible Navbar]                            │
│  • Compact breadcrumb / back button                         │
│  • Activity dropdown with truncation                        │
│  • Toggle trigger to collapse / expand                      │
│                                                             │
│  [Center Layer: Canvas Workspace (100% Viewport)]           │
│  • Gesture priority: single-finger pan / node-drag          │
│  • Pinch-to-zoom enabled                                    │
│  • Fit-view trigger on double-tap or center button          │
│                                                             │
│  [Bottom Layer: Docked / Collapsible Floating Toolbar]      │
│  • Thumb-zone positioning (bottom-center or bottom-bar)     │
│  • Minimized state: 1-tap FAB or pill                       │
│  • Expanded state: Full tool array with safe-area insets   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Core Responsive Principles for Canvas Platforms

### A. Breakpoints & Viewport Segments
1. **Mobile & Tablet (including Tablet Landscape, `< 1280px` / `< xl`)**:
   - **Collapsible UI**: Navbar (top) and Toolbar (bottom) are independently foldable with toggle triggers and floating pills (`ChevronUp`/`ChevronDown`).
   - **Positioning**: Navigation stays at top-left; toolbar docks at bottom-center (avoids top-center overlap with navbar courses/activities).
   - **Dropdowns**: Positioned cleanly with floating overlays (`fixed top-14 left-2.5 sm:left-4`).
   - **Target Sizing**: Minimum touch target of 44x44px for primary buttons.

2. **Desktop (`>= 1280px` / `xl`)**:
   - Fixed floating layout with top-center toolbar and top-left navigation, full tooltips, and expanded labels.

---

## 3. Implementation Pattern: Mobile Collapsible Navbar & Toolbar

```tsx
// State management for mobile overlay folding
const [isMobileNavFolded, setIsMobileNavFolded] = useState(false)
const [isMobileToolbarFolded, setIsMobileToolbarFolded] = useState(false)

// Mobile Top Navbar (Collapsible)
<div className={cn(
  "fixed top-3 left-3 right-3 z-50 transition-all duration-300 transform sm:right-auto sm:left-4 sm:top-4",
  isMobileNavFolded ? "-translate-y-16 pointer-events-none opacity-0 sm:translate-y-0 sm:pointer-events-auto sm:opacity-100" : "translate-y-0 opacity-100"
)}>
  {/* Navbar contents */}
</div>

// Mobile Navbar Toggle Pill (Visible when folded)
{isMobileNavFolded && (
  <button 
    onClick={() => setIsMobileNavFolded(false)}
    className="fixed top-3 left-3 z-50 sm:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 border shadow-md text-xs font-semibold"
  >
    <ChevronDown className="w-3.5 h-3.5" />
    <span>Navegación</span>
  </button>
)}
```

---

## 4. Mobile Bottom Toolbar Placement

Desktop floating toolbars located at `top-4 left-1/2` should become bottom-docked on mobile:

```tsx
<div className={cn(
  "fixed z-50 transition-all duration-300",
  // Desktop: floating top center
  "sm:top-4 sm:bottom-auto sm:left-1/2 sm:-translate-x-1/2",
  // Mobile: floating bottom center
  "bottom-4 left-1/2 -translate-x-1/2 max-w-[95vw]",
  isMobileToolbarFolded && "sm:translate-y-0 translate-y-24 pointer-events-none opacity-0"
)}>
  {/* Full toolbar */}
</div>
```

---

## 5. Touch Accessibility Checklist
- [x] All buttons have touch-manipulation CSS (`touch-action: manipulation`).
- [x] Node text uses `select-none` to prevent accidental text selection during multi-touch gestures.
- [x] Modals have `max-h-[85vh]` and `overflow-y-auto` with safe-area padding (`pb-safe`).
- [x] Zoom controls (`Controls`) do not overlap bottom navigation or install banners.
