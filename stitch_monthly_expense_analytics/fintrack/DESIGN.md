---
name: FinTrack
colors:
  surface: '#f6fbf1'
  surface-dim: '#d6dcd2'
  surface-bright: '#f6fbf1'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f5eb'
  surface-container: '#eaf0e6'
  surface-container-high: '#e4eae0'
  surface-container-highest: '#dfe4da'
  on-surface: '#171d17'
  on-surface-variant: '#3f4a3e'
  inverse-surface: '#2c322b'
  inverse-on-surface: '#edf2e9'
  outline: '#6f7a6d'
  outline-variant: '#becabb'
  surface-tint: '#006e2d'
  primary: '#005e26'
  on-primary: '#ffffff'
  primary-container: '#007a33'
  on-primary-container: '#a1ffad'
  inverse-primary: '#77dc88'
  secondary: '#126a5b'
  on-secondary: '#ffffff'
  secondary-container: '#a3f2de'
  on-secondary-container: '#1c7061'
  tertiary: '#2d594f'
  on-tertiary: '#ffffff'
  tertiary-container: '#467167'
  on-tertiary-container: '#c5f3e7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#93f9a2'
  primary-fixed-dim: '#77dc88'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005320'
  secondary-fixed: '#a3f2de'
  secondary-fixed-dim: '#88d5c2'
  on-secondary-fixed: '#00201a'
  on-secondary-fixed-variant: '#005144'
  tertiary-fixed: '#beece0'
  tertiary-fixed-dim: '#a2d0c4'
  on-tertiary-fixed: '#00201b'
  on-tertiary-fixed-variant: '#224e45'
  background: '#f6fbf1'
  on-background: '#171d17'
  surface-variant: '#dfe4da'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  margin-mobile: 16px
  margin-desktop: 32px
  gutter: 16px
  stack-sm: 4px
  stack-md: 12px
  stack-lg: 24px
---

## Brand & Style

The brand personality of this design system is "Prosperity in Balance." It is designed for B2C personal finance management, moving away from the cold precision of traditional fintech into a space that feels encouraging, safe, and nurturing. The target audience is everyday consumers looking to build wealth and track spending with confidence.

The visual style is **Modern Corporate with a Humanist touch**. It leverages high-quality whitespace, a lush monochromatic green palette to symbolize growth, and soft, approachable geometry. By prioritizing a clean Light Mode interface, the system evokes a sense of clarity and optimism, making financial data feel less like a chore and more like a path toward personal success.

## Colors

The "Wealthy Greens" palette is the foundation of this design system, representing stability and financial growth. 

- **Primary (#007a33):** Used for key actions and brand identity. It provides enough contrast against light backgrounds for accessibility.
- **Surface (#e0f7f1):** A very light, minty tint used for card backgrounds, section containers, and subtle UI layering.
- **On-Surface (#004d00):** A deep, forest green used for primary text and icons to ensure maximum readability while staying within the green-scale family.
- **Secondary & Tertiary:** These mid-tones are reserved for data visualization and success states, creating a cohesive "green-on-green" aesthetic.
- **Background:** A near-white neutral (#f8faf9) serves as the base canvas to keep the interface airy.

## Typography

This design system utilizes **Plus Jakarta Sans** across all levels. Its humanist characteristics and soft curves provide a modern, friendly feel that balances financial authority with consumer accessibility.

- **Headlines:** Use Bold or Semi-Bold weights with slight negative letter-spacing for a tight, professional look in financial summaries.
- **Body:** Standard weights are used for readability. We favor generous line heights to ensure the interface feels "breathable."
- **Data Points:** Currency values should use the `headline-md` style to ensure they remain the focal point of the user's dashboard.

## Layout & Spacing

The design system employs a **Fluid Grid** model based on an 8px rhythm. 

- **Mobile:** A 4-column layout with 16px side margins. 
- **Desktop:** A 12-column centered layout with a max-width of 1200px and 32px margins. 
- **Rhythm:** Vertical spacing between cards or sections should follow the `stack-lg` (24px) token to prevent the "wealthy" palette from feeling cluttered. Smaller groupings within cards use `stack-md` (12px).

## Elevation & Depth

This design system uses **Tonal Layers** rather than heavy shadows to convey depth.

- **Level 0 (Background):** The base neutral background.
- **Level 1 (Surface):** The Surface green (#e0f7f1) is used for the largest containers and cards.
- **Level 2 (In-Card):** White containers inside the light green surface create a "lifted" appearance.
- **Interactive States:** Use a very soft, tinted shadow (4% opacity of On-Surface) only on primary buttons or active modal windows to provide a tactile feel without breaking the clean, light aesthetic.

## Shapes

To transition to a friendly B2C feel, we utilize a **Rounded** shape language. 

- **Cards & Primary Containers:** Use `rounded-lg` (16px / 1rem) to create a soft, protective feel for financial data.
- **Buttons & Inputs:** Use the base `rounded` (8px / 0.5rem) for a modern, balanced look.
- **Small Elements:** Chips and badges should utilize `rounded-xl` (24px / 1.5rem) to appear pill-shaped and approachable.

## Components

- **Buttons:** Primary buttons use a solid Primary green background with white text. Secondary buttons use a ghost style with a Primary green border and text.
- **Input Fields:** Use a white background with a subtle Surface green border. Focus states should transition the border to Primary green with a 2px stroke.
- **Cards:** Cards are the backbone of the dashboard. They should feature the `rounded-lg` corner radius, a subtle Surface green background, and `stack-md` internal padding.
- **Data Visualization:** Charts should exclusively use the "Wealthy Greens" palette. Use the Primary color for the current period and Secondary/Tertiary tints for historical comparisons or background grid lines.
- **Chips:** Used for transaction categories (e.g., "Food", "Rent"). These are pill-shaped with a light Surface green fill and On-Surface text.
- **Progress Bars:** Thick, rounded bars using Tertiary as the track and Primary as the progress fill to visualize savings goals.