# Cognivibe Style Guide

This document captures the key styling constants and design tokens used across the Cognivibe application. Use these values for consistency when building new components or modifying existing ones.

---

## Colors

### Core Brand Surfaces (CSS Variables & HeroUI)

| Token | Hex | Usage |
|-------|-----|-------|
| `--cv-bg` / `background` | `#19141C` | Primary app background |
| `--cv-surface` / `content1` | `#221D28` | Cards, containers, surfaces |
| `content2` | `#272130` | Secondary surface |
| `content3` | `#2C2538` | Tertiary surface |
| `content4` | `#322A40` | Quaternary surface |
| `divider` | `#343037` | Dividers |

### Accent Colors (Primary Palette)

| Token | Hex | Usage |
|-------|-----|-------|
| `--cv-accent-primary` / `primary.DEFAULT` | `#A07CEF` | Primary accent, focus states |
| `--cv-accent-secondary` / `secondary.DEFAULT` | `#5C78FD` | Secondary accent (low cognitive load) |
| `--cv-accent-danger` / `danger.DEFAULT` | `#FF709B` | Danger, high cognitive load, alerts |

### Primary Scale (hero.ts)

| Shade | Hex |
|-------|-----|
| 50 | `#180535` |
| 100 | `#250A4C` |
| 200 | `#3F1679` |
| 300 | `#5A23A9` |
| 400 | `#7730DC` |
| 500 | `#8C58EA` |
| 600 | `#A07CEF` ← DEFAULT |
| 700 | `#B69EF3` |
| 800 | `#CDBEF7` |
| 900 | `#E5DFFB` |

### Secondary Scale

| Shade | Hex |
|-------|-----|
| 500 | `#2E4FFC` |
| 600 | `#5C78FD` ← DEFAULT |

### Danger Scale

| Shade | Hex |
|-------|-----|
| 500 | `#FF0A7C` |
| 600 | `#FF709B` ← DEFAULT |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `success.DEFAULT` | `#35E057` | Success states |
| `warning.DEFAULT` | `#F9CF58` | Warning states |
| `focus` | `#A07CEF` | Focus ring |

### Text & Overlays

| Token | Hex/Value | Usage |
|-------|-----------|-------|
| `foreground` | `#FFFFFF` | Primary text |
| `--cv-text-secondary` | `rgba(255, 255, 255, 0.6)` | Secondary/muted text |
| `text-foreground/60` | 60% opacity | Muted text |
| `border-white/10` | 10% white | Default borders |
| `border-white/15` | 15% white | Hover borders |
| `border-white/20` | 20% white | Stronger borders |
| `bg-white/5` | 5% white | Subtle backgrounds |
| `bg-white/10` | 10% white | Light overlays |
| `bg-white/20` | 20% white | Medium overlays |

### Cognitive Load Chart Colors

Used for load visualization (low → high):

| Load Range | Color | Hex |
|------------|-------|-----|
| 0–15 | Secondary (blue) | `#5C78FD` |
| 15–30 | Interpolate | `#5C78FD` → `#A07CEF` |
| 30–50 | Primary (purple) | `#A07CEF` |
| 50–65 | Interpolate | `#A07CEF` → `#FF709B` |
| 65+ | Danger (pink) | `#FF709B` |

### Wavy Background (Login/Onboarding)

| Token | Value |
|-------|-------|
| `backgroundFill` | `#1B063A` |
| `waveColors` | `#8C58EA`, `#2E4FFC`, `#8C58EA`, `#FF0A7C`, `#8C58EA` |
| `blur` | `10px` |
| `waveOpacity` | `0.5` |

---

## Typography

### Font Families

| Token | Font | Usage |
|-------|------|-------|
| `--font-sans` | Montserrat | Body text, small text |
| `--font-now` | Now | Headings (h1–h6), titles |

### Now Font Weights

| Weight | File | Usage |
|--------|------|-------|
| 100 | Now-Thin.otf | Thin |
| 300 | Now-Light.otf | Light |
| 400 | Now-Regular.otf | Regular |
| 500 | Now-Medium.otf | Medium |
| 700 | Now-Bold.otf | Bold |
| 900 | Now-Black.otf | Black |

### Text Sizes (Tailwind / HeroUI)

- `text-xs` – Extra small
- `text-sm` – Small
- `text-md` – Medium
- `text-lg` – Large
- `text-large` – HeroUI large
- `text-small` – HeroUI small

---

## Spacing

### Gaps

| Class | Value | Usage |
|-------|-------|-------|
| `gap-1` | 0.25rem | Tight spacing |
| `gap-1.5` | 0.375rem | Compact |
| `gap-2` | 0.5rem | Small |
| `gap-3` | 0.75rem | Medium |
| `gap-4` | 1rem | Standard |
| `gap-6` | 1.5rem | Large |

### Padding

| Class | Usage |
|-------|-------|
| `p-4` | Card padding |
| `p-6` | Page padding |
| `px-4`, `px-6`, `px-8` | Horizontal padding |
| `py-4`, `py-5`, `py-8` | Vertical padding |
| `pt-3`, `pb-2`, `pt-6` | Asymmetric padding |

### Layout Widths

| Value | Usage |
|-------|-------|
| `280px` | Sidebar / narrow column |
| `350px` | Content width breakpoint (GradientCard) |
| `500px` | Wide chart column |
| `max-w-sm` | Login form |
| `max-w-md` | Break page form |

---

## Borders & Radius

### Border Styles

| Class | Usage |
|-------|-------|
| `border border-white/10` | Default card/container border |
| `hover:border-white/15` | Hover state for interactive cards |
| `border-white/20` | Stronger borders (modals, inputs) |

### Border Radius

| Class | Usage |
|-------|-------|
| `rounded-md` | Small elements (badges, pills) |
| `rounded-lg` | Cards, buttons |
| `rounded-2xl` | Large cards, modals |
| `rounded-large` | HeroUI large radius |
| `rounded-full` | Avatars, dots, circular elements |
| `var(--heroui-radius-small)` | Scrollbar thumb |

---

## Shadows

| Class / Value | Usage |
|---------------|-------|
| `shadow-small` | HeroUI default (cards, modals) |
| `shadow-[0_10px_40px_rgba(0,0,0,0.35)]` | Date picker, elevated surfaces |

---

## Effects

| Class | Usage |
|-------|-------|
| `backdrop-blur-md` | Frosted glass (dropdowns, popovers) |
| `bg-content1/90` | Semi-transparent surface |
| `transition-colors` | Border/color transitions |
| `transition-transform` | Scale/hover effects |
| `hover:scale-105` | Avatar hover |

---

## Gradients

### Accent Gradient (`.bg-cv-accent-gradient`)

```css
linear-gradient(
  45deg,
  var(--cv-accent-primary) 0%,
  var(--cv-accent-primary) 60%,
  var(--cv-accent-danger) 100%
);
```

Used for: Welcome tour cards, CTA highlights.

---

## Cognitive Load Thresholds

Used for score-to-color mapping and messaging:

| Level | Threshold | Color | Message |
|-------|-----------|-------|---------|
| Low | ≤ 30 | Secondary (blue) | "You're running light today – perfect time to push your flow zone." |
| Mid | 31–65 | Primary (purple) | "You're in the flow zone, now is the time for deep-work." |
| High | > 65 | Danger (pink) | "You are getting too overwhelmed, consider taking a break." |

---

## Component Patterns

### Card Base

```
bg-content1 border border-white/10 hover:border-white/15 transition-colors
```

### Secondary Text

```
text-foreground/60 hover:text-foreground
```

### Icon/Indicator Dots (2.5×2.5)

```
w-2.5 h-2.5 rounded-full
```

### Navbar

```
py-4 sticky top-0 z-40
```

### Logo Height

```
h-12
```

### Buttons

Two distinct button types, each with its own styling:

#### 1. Action / CTA buttons (default)

**Use for:** Primary actions, CTAs, form submits, navigation steps — anything that drives the main flow.

**Visual:** Full, filled, prominent. Often larger (`size="lg"`), solid background.

**Styling:** Now font, medium weight (500), uppercase. Applied globally to all `<button>` elements.

**Examples:** START, SUBMIT, SEND, CANCEL, NEXT, SAVE CHANGES, TRACKING.

---

#### 2. Infrastructural buttons (`btn-plain`)

**Use for:** UI controls, filters, toggles, segmented controls — smaller, outlined, utilitarian elements that support the interface rather than drive it.

**Visual:** Smaller, outlined or ghost, often in groups (e.g. date pills, view toggles). Part of the chrome, not the content.

**Styling:** Montserrat, regular weight (400), normal casing. Add `className="btn-plain"` to opt out of the default button styling.

**Examples:** Today, Yesterday, Last week, Total score, Submetrics, Delete Account.

---

**Rule of thumb:** If it’s a big filled button that commits an action or moves the user forward → default. If it’s a smaller outlined control that filters, toggles, or configures → `btn-plain`.

---

### Survey sliders (source of truth: SessionSurvey)

All survey-style sliders (0–100 scale with left/right labels) should match SessionSurvey:

| Prop / Class | Value |
|---------------|-------|
| Slider `size` | `md` |
| Slider `color` | `primary` when touched, `foreground` when untouched |
| Slider | `showTooltip`, `tooltipProps={{ content: String(value) }}` |
| Question text | `text-sm font-medium text-foreground` |
| Container | `space-y-2`, `px-2` |
| Labels row | `flex justify-between mt-1` |
| Left/right labels | `text-xs text-default-700` |
| Value display | `text-xs font-semibold text-primary` |

**Used in:** SessionSurvey, QuestionnaireModal, ZScoreSurveyModal.

**Note:** Settings sliders (break duration, score threshold, etc.) use `size="sm"` and a different layout — they are infrastructural controls, not survey inputs.

---

## Utility Classes

| Class | Purpose |
|-------|---------|
| `.text-cv-secondary` | Applies `--cv-text-secondary` |
| `.bg-cv-accent-gradient` | Applies accent gradient |
| `.btn-plain` | Infrastructural button: Montserrat, normal casing (opt out of action-button styling) |

---

## Scrollbar

- Width/height: `10px`
- Track: `hsl(var(--heroui-background))`
- Thumb: `hsl(var(--heroui-primary-600))`, `border-radius: var(--heroui-radius-small)`
- Thumb hover: `hsl(var(--heroui-primary-700))`

---

## Source References

- **App.css** – CSS variables, fonts, scrollbar, utilities
- **hero.ts** – HeroUI theme (colors, dark mode)
- **SessionSurvey** – Survey slider styling (source of truth)
- **CognitiveLoadChart** – Load-to-color mapping
- **CircleChartCard** – Cognitive load thresholds
- **GradientCard** – Breakpoint, gradient usage
- **WavyBackground** – Login/onboarding background
