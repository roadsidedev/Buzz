# Design System Quick Reference Card

**Neobrutalism UI Design System for ClawHouse**

---

## Colors at a Glance

### Palette
```
■ #000000  Black      (Primary background, text, borders)
■ #FFFFFF  White      (Secondary background, content)
■ #0EA5E9  Cyan       (Primary interactive, focus, links)
■ #EC4899  Magenta    (Featured, secondary action)
■ #F59E0B  Yellow     (Warning, alert)
■ #10B981  Green      (Success)
■ #EF4444  Red        (Error, destructive)
■ #3B82F6  Blue       (Info)
```

### Usage
```
Text:       #000000 (black) on #FFFFFF (white)
Links:      #0EA5E9 (cyan) with underline
Borders:    2px solid #000000 (black)
Focus:      #0EA5E9 (cyan) border + inner glow
Error:      #EF4444 (red) border + text
Success:    #10B981 (green) background/border
Warning:    #F59E0B (yellow) background/border
```

---

## Typography Stack

### Fonts
```
Display:  Space Grotesk 700     → H1, H2 (headings, uppercase)
Body:     Inter 400–700         → Paragraphs, UI text
Mono:     JetBrains Mono 400    → Code, technical content
```

### Sizes
```
H1:       60px (3.75rem)   Bold  → Page titles
H2:       36px (2.25rem)   Bold  → Section headings
H3:       24px (1.5rem)    Bold  → Card titles
Body:     16px (1rem)      400   → Default text
Small:    14px (0.875rem)  400   → Meta, captions
Mono:     14px (0.875rem)  400   → Code
```

### Styling
```
Line Height:    1.5 for body, 1.2 for headings
Letter Spacing: 0.05em on labels, uppercase text
Font Weight:    Bold (700) for emphasis, Normal (400) for body
Transform:      UPPERCASE on headings and labels
```

---

## Spacing System

### Scale (4px increments)
```
1   = 4px    (0.25rem)
2   = 8px    (0.5rem)
3   = 12px   (0.75rem)
4   = 16px   (1rem)
6   = 24px   (1.5rem)
8   = 32px   (2rem)
12  = 48px   (3rem)
16  = 64px   (4rem)
```

### Usage
```
Padding (inside):
  sm = 12px (3)    → Small containers
  md = 24px (6)    → Medium containers (default)
  lg = 32px (8)    → Large containers

Margin (outside):
  Use gaps instead of margins when possible
  Exception: h1 margin-bottom = 24px

Gap (between items):
  Flex/grid items: 16px (4) or 24px (6) common
```

---

## Borders & Shadows

### Borders
```
Width:     2px solid #000000 (standard)
           4px solid #000000 (emphasis)
           1px solid #000000 (thin detail)

Radius:    0px (default, sharp corners)
           4px (max, rare occasions)

Style:     solid (most common)
           dashed (secondary, alternate)
           dotted (rare)
```

### Shadows (Minimal)
```
Focus:     inset 0 0 0 3px rgba(14, 165, 233, 0.1)
Glow:      0 0 20px rgba(14, 165, 233, 0.5)
Inset:     inset 0 2px 4px 0 rgb(0 0 0 / 0.05)

❌ Avoid: Drop shadows, blur, soft gradients
```

---

## Components Cheat Sheet

### Button
```typescript
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="accent">Accent</Button>

<Button size="sm|md|lg">Size</Button>
<Button disabled>Disabled</Button>
<Button isLoading>Loading...</Button>
```

### Card
```typescript
<Card padding="sm|md|lg">Content</Card>
<Card variant="default|bordered|flat">Content</Card>
<Card isClickable>Clickable Card</Card>
```

### Badge
```typescript
<Badge variant="default|primary|secondary|success|warning|error">
  Label
</Badge>
<Badge isLive>LIVE</Badge>
```

### Input
```typescript
<Input type="text|email|password|number|search" />
<Input label="Field Name" />
<Input error="Error message" />
<Input helperText="Help text" />
```

### Textarea
```typescript
<Textarea label="Field" />
<Textarea maxLength={500} showCharCount />
<Textarea error="Error" helperText="Help" />
```

---

## Tailwind Class Patterns

### Colors
```
bg-base-black       → Background
bg-base-white       → Background
text-base-black     → Text
text-primary-500    → Cyan text
border-base-black   → 2px black border
border-primary-500  → 2px cyan border
```

### Spacing
```
p-4                 → 16px padding
px-6                → 24px horizontal padding
py-3                → 12px vertical padding
m-4                 → 16px margin
gap-4               → 16px gap between items
```

### Typography
```
text-2xl            → Large text (24px)
text-lg             → Body large (18px)
text-base           → Default (16px)
text-sm             → Small (14px)
font-bold           → 700 weight
font-semibold       → 600 weight
uppercase           → UPPERCASE TEXT
tracking-wide       → Letter spacing
```

### Borders
```
border-2            → 2px border (default)
border-4            → 4px border (thick)
border-base-black   → Black color
rounded-none        → 0px radius (sharp)
rounded-lg          → 4px radius (max)
```

### Responsive
```
md:grid-cols-2      → 2 columns on tablet+
lg:flex-row         → Row layout on desktop+
hidden md:block      → Hide mobile, show tablet+
```

### Animations
```
animate-pulse       → Pulsing effect
animate-spin        → Spinning loader
animate-fade-in     → Fade in animation
hover:bg-white      → Hover state
active:scale-95     → Active state (scale down)
disabled:opacity-50 → Disabled state
```

---

## Dark Mode Classes

### Automatic with System Preference
```css
@media (prefers-color-scheme: dark) {
  body { background: #0f0f0f; color: #fff; }
}
```

### Tailwind Dark Mode Class
```html
<!-- Add dark class to switch modes -->
<div class="bg-white dark:bg-black">
  Adapts to dark mode
</div>
```

---

## Responsive Breakpoints

### Mobile-First Approach
```
Default        → 375px+ (mobile)
md:            → 768px+ (tablet)
lg:            → 1024px+ (desktop)
xl:            → 1280px+ (wide)
```

### Example
```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  Single column on mobile, 2 on tablet, 3 on desktop
</div>
```

---

## Animation Durations

```
Fade-in:    0.3s ease-in-out
Slide-up:   0.3s ease-out
Glitch:     0.15s ease-in-out
Pulse:      2s infinite
Spin:       1s linear infinite
```

---

## Accessibility Checklist

- [x] Contrast ratio > 4.5:1 (WCAG AA)
- [x] Focus indicators visible (3px cyan border)
- [x] Keyboard navigation (Tab, Enter, Escape)
- [x] ARIA labels on interactive elements
- [x] Error messages with color + text
- [x] Status indicators not color-only
- [x] Min font size: 14px
- [x] Min touch target: 44px

---

## Common Patterns

### Form Layout
```typescript
<div className="space-y-6">
  <Input label="Name" />
  <Input label="Email" />
  <Textarea label="Message" />
  <Button variant="accent">Submit</Button>
</div>
```

### Card Grid
```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {items.map(item => <Card key={item.id}>{item}</Card>)}
</div>
```

### Hero Section
```typescript
<section className="bg-base-black text-white p-12 border-b-4 border-primary-500">
  <h1 className="text-6xl font-bold mb-4">Heading</h1>
  <p className="text-xl mb-6">Description</p>
  <Button variant="accent">Action</Button>
</section>
```

### Status Display
```typescript
<div className="flex items-center gap-2">
  <Badge variant={statusVariant}>Status</Badge>
  <span className="text-sm">Descriptive text</span>
</div>
```

---

## Do's & Don'ts

### ✅ DO
- Use 2px black borders for emphasis
- Apply UPPERCASE to headings/labels
- Keep animations < 0.5s (snappy)
- Use cyan (#0EA5E9) for interactive elements
- Maintain 1.5 line-height for readability
- Add letter-spacing to uppercase text
- Test at 375px, 768px, 1024px breakpoints
- Use system fonts (no custom downloads)

### ❌ DON'T
- Use drop shadows (use borders instead)
- Add rounded corners (keep 0px)
- Apply gradients (stick to flat colors)
- Mix more than 3 fonts
- Use light gray text on white (contrast issue)
- Justify text (alignment issues)
- Add unnecessary margins (use gap)
- Forget dark mode support

---

## Resources

- **Full Guide:** `DESIGN_SYSTEM.md`
- **Component Examples:** `COMPONENT_USAGE_GUIDE.md`
- **Design Tokens:** `DESIGN_TOKENS.ts`
- **Tailwind Docs:** https://tailwindcss.com/
- **Neobrutalism:** https://www.are.na/search/neobrutalism

---

**Last Updated:** February 15, 2026  
**Status:** ✅ Complete & Ready for Implementation  
**Print this card and tape it to your monitor!**
