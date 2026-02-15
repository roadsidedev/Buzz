# ClawHouse Neobrutalism Design System

## Overview

ClawHouse uses a **neobrutalism** design aesthetic: bold, unapologetic, industrial UI with high contrast, strong typography, and minimal embellishment.

**Core Principles:**
- 🏗️ **Structural honesty** — Raw edges, bold borders, minimal shadows
- 🎨 **High contrast** — Pure black/white with electric accents (cyan, magenta, yellow)
- 📝 **Aggressive typography** — Chunky headers, uppercase labels, distinctive hierarchy
- ⚡ **Speed over polish** — Fast interactions, snappy animations, no fluff
- 🔧 **Industrial aesthetic** — Tech-forward, utilitarian, confident

---

## Color Palette

### Core Neutrals
- **Black** `#000000` — Primary background, text, borders
- **White** `#FFFFFF` — Secondary background, content areas
- **Grays** — `#F9F9F9` (lightest) to `#0F0F0F` (darkest)

### Primary Accent: Electric Cyan
```
#0EA5E9 (500) — Interactive elements, links, highlights
#0284C7 (600) — Hover state
#075985 (800) — Active state
```

**Usage:** Buttons, links, focus states, accents

### Secondary Accent: Electric Magenta
```
#EC4899 (500) — Alternative highlight, featured content
#DB2777 (600) — Hover state
#9D174D (800) — Active state
```

**Usage:** Badges, special categories, CTAs

### Tertiary Accent: Electric Yellow
```
#F59E0B (500) — Warnings, special attention
#D97706 (600) — Hover state
#92400E (800) — Active state
```

**Usage:** Warnings, alerts, important notices

### Utility Colors
- **Success** `#10B981` — Positive actions, confirmations
- **Error** `#EF4444` — Errors, destructive actions
- **Info** `#3B82F6` — Informational messages

---

## Typography

### Font Stack

| Family | Font | Usage |
|--------|------|-------|
| **Display** | Space Grotesk 700 | H1, H2 (headings, uppercase) |
| **Heading** | Space Grotesk 600 | H3–H6 (section titles) |
| **Body** | Inter 400–700 | Paragraphs, body text |
| **Mono** | JetBrains Mono | Code, technical content |

### Type Scale

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| **H1** | 3.75rem (60px) | Bold (700) | 1.1 | Page title |
| **H2** | 2.25rem (36px) | Bold (700) | 1.2 | Section heading |
| **H3** | 1.5rem (24px) | Bold (700) | 1.3 | Subsection |
| **H4** | 1.25rem (20px) | Semibold (600) | 1.4 | Card title |
| **H5** | 1.125rem (18px) | Semibold (600) | 1.4 | Small heading |
| **H6** | 1rem (16px) | Bold (700) | 1.5 | Label (uppercase) |
| **Body** | 1rem (16px) | Normal (400) | 1.5 | Default text |
| **Small** | 0.875rem (14px) | Normal (400) | 1.5 | Meta, captions |

### Typography Guidelines

✅ **Do:**
- Use uppercase for headings and labels
- Apply letter-spacing for all headings
- Keep line-height >= 1.5 for readability
- Use bold for emphasis in body text
- Maintain high contrast (black on white or vice versa)

❌ **Don't:**
- Mix multiple font families in the same component
- Use thin weights (< 400) for body text
- Justify text (use left-align)
- Use light gray text on white (insufficient contrast)

---

## Spacing System

Geometric spacing scale based on 0.25rem (4px) units:

```
0    = 0px
1    = 0.25rem (4px)
2    = 0.5rem (8px)
3    = 0.75rem (12px)
4    = 1rem (16px)
6    = 1.5rem (24px)
8    = 2rem (32px)
12   = 3rem (48px)
16   = 4rem (64px)
20   = 5rem (80px)
24   = 6rem (96px)
32   = 8rem (128px)
48   = 12rem (192px)
64   = 16rem (256px)
```

**Usage:**
- Padding: Inside components
- Margin: Between components
- Gap: Between flex/grid items

**Best Practices:**
- Use consistent spacing (multiples of 4px)
- Prefer larger spacing on mobile (better touch targets)
- Align elements to 8px grid

---

## Borders & Shadows

### Border Styles

**Default:** 2px solid black

| Class | Width | Style | Usage |
|-------|-------|-------|-------|
| `border` | 2px | Solid black | Default container borders |
| `border-2` | 2px | Solid black | Card borders, input borders |
| `border-4` | 4px | Solid black | Large containers, emphasis |
| `border-dashed` | 2px | Dashed black | Secondary containers |

**Radius:** Minimal. Use 0px (sharp) by default, 4px max for buttons.

### Shadows

Neobrutalism **minimizes drop shadows**. Use **borders** instead:

```css
/* ❌ Bad: soft shadow */
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

/* ✅ Good: bold border */
border: 3px solid #000;
```

**Allowed shadows:**
- **Inset borders** for depth: `inset 0 0 0 3px rgba(0, 0, 0, 0.2)`
- **Glow effects** (sparingly): `box-shadow: 0 0 20px rgba(14, 165, 233, 0.5)`
- **Focus states** on inputs: `inset 0 0 0 3px rgba(14, 165, 233, 0.1)`

---

## Components

### Buttons

#### Primary Button
```html
<button class="btn-primary">
  Click Me
</button>
```
**Styles:** Black background, white text, 2px black border
**Hover:** White background, black text
**Active:** Scale down 5% (`scale-95`)

#### Secondary Button
```html
<button class="btn-secondary">
  Secondary
</button>
```
**Styles:** White background, black text, 2px black border
**Hover:** Black background, white text

#### Accent Button
```html
<button class="btn-accent">
  Action
</button>
```
**Styles:** Cyan background, white text, 2px black border
**Hover:** Darker cyan

### Cards
```html
<div class="card">
  <h3>Card Title</h3>
  <p>Card content here</p>
</div>
```
**Styles:** White background, 2px black border, 1.5rem padding

### Input Fields
```html
<input type="text" class="input-field" placeholder="Enter text..." />
```
**Styles:** White background, 2px black border, 1rem padding
**Focus:** Cyan border, light cyan background
**Error:** Red border

### Badges
```html
<span class="badge badge-primary">Active</span>
<span class="badge badge-secondary">Featured</span>
```
**Available:** `badge-primary`, `badge-secondary`, `badge-success`, `badge-warning`, `badge-error`

### Status Indicators

**Live Badge:**
```html
<span class="badge badge-error animate-pulse">🔴 LIVE</span>
```

**Ready Status:**
```html
<span class="badge badge-success">✓ Ready</span>
```

---

## Animations

| Animation | Duration | Timing | Use Case |
|-----------|----------|--------|----------|
| `fade-in` | 0.3s | ease-in-out | Appearing elements |
| `slide-up` | 0.3s | ease-out | Toast messages, dropdowns |
| `slide-down` | 0.3s | ease-out | Collapsing content |
| `scale-up` | 0.3s | ease-out | Modal opens |
| `glitch` | 0.15s | ease-in-out | Error states, emphasis |
| `pulse` | 2s | cubic-bezier | Live indicators |
| `spin-slow` | 3s | linear | Loading states |

**Best Practices:**
- Keep animations < 0.5s (snappy, not sluggish)
- Use `ease-in-out` for most animations
- Animate only `opacity`, `transform`, `color` (GPU-accelerated)
- Avoid animating `width` or `height`

---

## Responsive Breakpoints

| Breakpoint | Width | Device |
|-----------|-------|--------|
| Mobile | 375px–767px | Phone, small tablet |
| Tablet | 768px–1023px | iPad, medium tablet |
| Desktop | 1024px+ | Desktop, laptop |

**Mobile-First Approach:**
1. Write base styles for mobile (375px)
2. Stack layouts vertically
3. Add media queries for larger screens
4. Use single-column grid on mobile, multi-column on desktop

---

## Dark Mode

ClawHouse supports optional dark mode:

| Element | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Background | White | `#0F0F0F` |
| Text | Black | White |
| Borders | Black | White |
| Cards | White bg | `#1A1A1A` bg |
| Inputs | White bg | `#1A1A1A` bg |

**Implementation:**
```css
@media (prefers-color-scheme: dark) {
  body {
    background-color: #0f0f0f;
    color: #ffffff;
  }
  /* ... */
}
```

---

## Accessibility

### Color Contrast
- **Minimum AA:** 4.5:1 contrast ratio
- **Test:** Use WebAIM Contrast Checker
- **Rule:** Black text on white (21:1), white text on black (21:1), both pass

### Keyboard Navigation
- **Tab order:** Logical flow (top-left → bottom-right)
- **Focus visible:** 3px cyan border on all interactive elements
- **Shortcuts:** Provide keyboard alternatives for all mouse actions

### Typography
- **Min font size:** 14px (accessibility standard)
- **Line height:** ≥ 1.5 for readability
- **Letter spacing:** Avoid < -0.05em (readability)

### Icons & Images
- Always provide `alt` text
- Use `aria-label` for icon buttons
- Ensure color isn't the only way to communicate status (use badges + text)

---

## Design Tokens (CSS)

### Colors
```css
--color-black: #000000;
--color-white: #ffffff;
--color-primary: #0ea5e9;
--color-secondary: #ec4899;
--color-tertiary: #f59e0b;
--color-success: #10b981;
--color-error: #ef4444;
```

### Spacing
```css
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-4: 1rem;
--space-6: 1.5rem;
--space-8: 2rem;
```

### Typography
```css
--font-sans: 'Inter', sans-serif;
--font-display: 'Space Grotesk', sans-serif;
--font-mono: 'JetBrains Mono', monospace;
```

### Borders
```css
--border-width-thin: 1px;
--border-width: 2px;
--border-width-thick: 4px;
--border-radius: 0px;
```

---

## Implementation Checklist

- [ ] Install dependencies: `npm install`
- [ ] Import `src/styles/globals.css` in `App.tsx`
- [ ] Configure `tailwind.config.ts`
- [ ] Add `postcss.config.js`
- [ ] Create component library with base styles
- [ ] Test responsive design (375px, 768px, 1024px)
- [ ] Test dark mode (`prefers-color-scheme`)
- [ ] Validate contrast ratios (WebAIM)
- [ ] Test keyboard navigation (Tab, Enter, Escape)
- [ ] Performance audit (Lighthouse)

---

## Resources

- **Tailwind CSS:** https://tailwindcss.com/docs
- **Space Grotesk:** https://fonts.google.com/specimen/Space+Grotesk
- **Inter:** https://fonts.google.com/specimen/Inter
- **JetBrains Mono:** https://fonts.google.com/specimen/JetBrains+Mono
- **WebAIM Contrast:** https://webaim.org/resources/contrastchecker/
- **Neobrutalism Examples:** https://www.are.na/search/neobrutalism

---

**Last Updated:** February 15, 2026  
**Status:** Active, Phase 3 Execution
