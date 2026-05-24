---
name: Fintech Precision System
colors:
  surface: '#13131b'
  surface-dim: '#13131b'
  surface-bright: '#393841'
  surface-container-lowest: '#0d0d15'
  surface-container-low: '#1b1b23'
  surface-container: '#1f1f27'
  surface-container-high: '#292932'
  surface-container-highest: '#34343d'
  on-surface: '#e4e1ed'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#e4e1ed'
  inverse-on-surface: '#303038'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb2b7'
  on-tertiary: '#67001b'
  tertiary-container: '#ff516a'
  on-tertiary-container: '#5b0017'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdadb'
  tertiary-fixed-dim: '#ffb2b7'
  on-tertiary-fixed: '#40000d'
  on-tertiary-fixed-variant: '#92002a'
  background: '#13131b'
  on-background: '#e4e1ed'
  surface-variant: '#34343d'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  numeric-data:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-padding-mobile: 1rem
  container-padding-desktop: 2rem
  gutter: 1.5rem
  card-gap: 1rem
---

## Brand & Style

This design system is built for high-stakes financial clarity. The brand personality is **precise, empowering, and clinical**. It targets users who demand immediate insight into their financial health without the friction of decorative "fluff."

The aesthetic follows a **Modern Minimalist** approach with a heavy emphasis on **Information Architecture**. By utilizing a deep, dark base, we reduce cognitive load and visual fatigue, allowing vibrant semantic accents (Emerald and Coral) to communicate status and trends instantly. The UI feels like a high-end dashboard: professional, reliable, and technologically advanced.

## Colors

The palette is anchored in a **Dark Mode** foundation to provide a premium, sophisticated feel. 

- **Primary (Indigo):** Reserved for high-intent actions, primary buttons, and active states.
- **Success (Emerald):** Used strictly for income, positive balances, and growth trends.
- **Danger (Coral):** Used for expenses, over-budget alerts, and negative trends.
- **Neutrals:** The "Deep Navy" functions as the global background, while "Slate" defines the card surfaces and container boundaries, creating a clear hierarchy of information depth.

## Typography

**Inter** is the sole typeface for this design system, chosen for its exceptional legibility in data-dense environments.

- **Tabular Figures:** For all financial data and transaction lists, use `tnum` (tabular figures) to ensure numbers align vertically in columns.
- **Hierarchy:** Large display sizes are used for account balances. Labels are frequently uppercased with slight letter spacing to differentiate them from interactive body text.
- **Contrast:** Secondary information (timestamps, metadata) should use a reduced opacity (60-70%) of the neutral foreground rather than a different font weight.

## Layout & Spacing

The design system utilizes a **12-column fluid grid** for desktop and a **4-column grid** for mobile. 

- **Sidebar Navigation:** On desktop, a fixed 280px sidebar anchors the navigation. On mobile, this transitions to a bottom navigation bar or a full-screen overlay.
- **Card-Based Architecture:** All primary content must reside within cards. Cards should span 4, 6, or 12 columns depending on the data complexity.
- **Rhythm:** An 8px linear scale is used for all padding and margins. Use `24px` (3 units) for internal card padding to ensure data doesn't feel cramped.

## Elevation & Depth

This design system uses **Tonal Layering** combined with **Ambient Shadows** to create a sense of physical stacks.

1.  **Base (Level 0):** The Deep Navy (#0F172A) background.
2.  **Surface (Level 1):** Card containers using Slate (#1E293B). These feature a very subtle 1px border (#334155) to define edges.
3.  **Raised (Level 2):** Modals, dropdowns, and hovered cards. These use a slightly lighter slate and a soft, diffused shadow: `0 10px 15px -3px rgba(0, 0, 0, 0.5)`.

Avoid heavy blurs or glassmorphism to maintain maximum contrast for readability.

## Shapes

The shape language is **distinctly rounded** to soften the technical nature of fintech data. 

- **Standard Containers:** Use a `12px` (0.75rem) radius for standard cards and input fields.
- **Featured Elements:** Large promotional cards or primary balance displays use a `16px` (1rem) radius.
- **Interactive Small Elements:** Chips and tags use a fully rounded (pill-shaped) radius to distinguish them from clickable buttons.

## Components

### Buttons
- **Primary:** Solid Indigo background with white text. High-contrast.
- **Secondary:** Transparent with a 1px Slate border.
- **Destructive:** Solid Coral, reserved for "Delete Account" or "Cancel Transaction."

### Data Cards
Cards are the primary vehicle for information. They must include a clear header, a primary metric (in `numeric-data` style), and a trend indicator (Emerald or Coral).

### Progress Bars
Used for budget tracking. The track is a dark slate (#334155), and the fill is Indigo. If a budget is exceeded, the fill color must switch to Coral automatically.

### Input Fields
Fields should be "filled" style with a Slate (#1E293B) background and a 1px bottom border that glows Indigo on focus. Labels sit above the field in the `label-md` style.

### Sidebar Navigation
The sidebar should use a subtle vertical separator. Active states are indicated by a left-hand Indigo accent bar (4px width) and a slight lightening of the background.