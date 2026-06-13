---
name: Emerald Trust
colors:
  surface: '#f8f9ff'
  surface-dim: '#d0dbed'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dee9fc'
  surface-container-highest: '#d9e3f6'
  on-surface: '#121c2a'
  on-surface-variant: '#3f4a3e'
  inverse-surface: '#27313f'
  inverse-on-surface: '#eaf1ff'
  outline: '#6f7a6d'
  outline-variant: '#becabb'
  surface-tint: '#006e2d'
  primary: '#005e26'
  on-primary: '#ffffff'
  primary-container: '#007a33'
  on-primary-container: '#a1ffad'
  inverse-primary: '#77dc88'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#1b5b47'
  on-tertiary: '#ffffff'
  tertiary-container: '#37745f'
  on-tertiary-container: '#b7f7dd'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#93f9a2'
  primary-fixed-dim: '#77dc88'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005320'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#b0f0d6'
  tertiary-fixed-dim: '#95d3ba'
  on-tertiary-fixed: '#002117'
  on-tertiary-fixed-variant: '#0b513d'
  background: '#f8f9ff'
  on-background: '#121c2a'
  surface-variant: '#d9e3f6'
typography:
  display-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 60px
    fontWeight: '700'
    lineHeight: 72px
    letterSpacing: -0.02em
  display-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  button:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 80px
  container-max: 1280px
---

## Brand & Style

This design system is built on a foundation of **Modern Corporate** aesthetics, blending the reliability of traditional finance with the agility of modern fintech. The brand personality is authoritative yet accessible, designed to evoke feelings of growth, security, and clarity for B2C users.

The style prioritizes high-quality whitespace, crisp typography, and a "precision-humanist" feel. We avoid unnecessary clutter, favoring a layout that breathes and allows information to be digested easily. Visual interest is generated through sophisticated color transitions and subtle elevation rather than decorative patterns. The goal is to position the product as a premium, intelligent partner in a user's financial journey.

## Colors

The palette centers on the "Wealthy Greens" spectrum. The **Primary Green (#007a33)** is used for high-impact brand moments and primary actions, providing a sense of stability. The **Secondary Green (#10b981)** acts as a vibrant accent for success states and secondary CTAs, adding a contemporary "fintech" energy.

While the primary interface is light-mode to maximize readability and trust, we utilize a deep **Forest Dark (#062010)** for hero sections and footers to provide a sophisticated anchor. Tertiary greens are used sparingly for backgrounds and decorative borders to maintain a monochromatic harmony that feels intentional and expensive.

## Typography

This design system employs a dual-font strategy. **Plus Jakarta Sans** is used for all headlines and interactive elements (buttons, nav links) to inject personality and a modern, friendly geometric feel. **Inter** is utilized for body copy and data-heavy labels to ensure maximum legibility and a professional, systematic tone.

For marketing headlines, use tight letter-spacing (-0.02em) to create a high-impact, editorial look. On mobile, display sizes scale down significantly to maintain visual hierarchy without overwhelming the small viewport.

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid** grid. On desktop, content is contained within a 1280px max-width container using a 12-column grid. On mobile, we use a single-column fluid layout with 20px side margins.

A strict 4px baseline grid ensures vertical rhythm. We favor "generous" spacing—use 80px to 120px of vertical padding between major marketing sections to create a premium, unhurried browsing experience. Elements within cards or components should use a consistent 16px or 24px internal padding.

## Elevation & Depth

To maintain a clean and modern appearance, the design system utilizes **Ambient Shadows**. We avoid heavy, black shadows in favor of soft, diffused shadows tinted with the primary green or a deep navy to keep them "clean."

- **Level 1 (Low):** Used for cards and input fields. A subtle 4px blur with 5% opacity.
- **Level 2 (Medium):** Used for hover states on interactive cards. An 8px blur with 10% opacity.
- **Level 3 (High):** Reserved for modals and dropdown menus. A 20px blur with 12% opacity.

Surfaces primarily use white or very light grey (#F9FAFB) backgrounds. Subtle 1px borders in a light neutral (#E5E7EB) are used to define boundaries without adding visual weight.

## Shapes

The shape language is **Rounded**, reflecting an approachable and friendly fintech identity. Standard UI elements like buttons, inputs, and small cards use a 0.5rem (8px) radius. Larger containers or marketing feature blocks should use the `rounded-xl` (1.5rem / 24px) setting to create a softer, more modern framing effect. 

Icons should follow this logic, using rounded terminals rather than sharp corners to ensure they feel part of the same visual family.

## Components

### Buttons
- **Primary:** Solid #007a33 background with white text. High-contrast, bold, and slightly taller (48px or 56px) for marketing CTAs.
- **Secondary:** Outlined with a 1.5px border of #007a33. Subtle hover fill of 5% primary color.

### Cards
Feature cards should utilize white backgrounds, Level 1 shadows, and 24px padding. For "Value Prop" sections, cards can use a 1px border instead of a shadow for a flatter, more systematic look.

### Input Fields
Inputs use a light grey background (#F3F4F6) with no shadow in their default state. Upon focus, they transition to a white background with a 2px primary green border and a soft Level 1 glow.

### Chips & Badges
Used for categories or status indicators. Use the secondary green (#10b981) at 10% opacity for the background and 100% opacity for the text to create a modern, readable "pill" look.

### Success Indicators
Always use the Secondary Green (#10b981) for success icons, progress bars, and positive financial trends to reinforce the "Wealthy Greens" growth narrative.