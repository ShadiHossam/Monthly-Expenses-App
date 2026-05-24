---
name: Emerald Institutional
colors:
  surface: '#121412'
  surface-dim: '#121412'
  surface-bright: '#383a37'
  surface-container-lowest: '#0d0f0d'
  surface-container-low: '#1a1c1a'
  surface-container: '#1e201e'
  surface-container-high: '#292a28'
  surface-container-highest: '#333533'
  on-surface: '#e3e3df'
  on-surface-variant: '#becabb'
  inverse-surface: '#e3e3df'
  inverse-on-surface: '#2f312e'
  outline: '#889486'
  outline-variant: '#3f4a3e'
  surface-tint: '#77dc88'
  primary: '#77dc88'
  on-primary: '#003914'
  primary-container: '#007a33'
  on-primary-container: '#a1ffad'
  inverse-primary: '#006e2d'
  secondary: '#88d5c2'
  on-secondary: '#00382e'
  secondary-container: '#006354'
  on-secondary-container: '#8edcc9'
  tertiary: '#8fd87d'
  on-tertiary: '#003a00'
  tertiary-container: '#337728'
  on-tertiary-container: '#b1fd9d'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#93f9a2'
  primary-fixed-dim: '#77dc88'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005320'
  secondary-fixed: '#a3f2de'
  secondary-fixed-dim: '#88d5c2'
  on-secondary-fixed: '#00201a'
  on-secondary-fixed-variant: '#005144'
  tertiary-fixed: '#aaf596'
  tertiary-fixed-dim: '#8fd87d'
  on-tertiary-fixed: '#002200'
  on-tertiary-fixed-variant: '#095305'
  background: '#121412'
  on-background: '#e3e3df'
  surface-variant: '#333533'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 16px
  container-max: 1440px
---

## Brand & Style

This design system is built for the high-stakes world of fintech, emphasizing stability, growth, and precision. It targets high-net-worth individuals and institutional investors who require a sophisticated, data-rich environment that feels premium and authoritative.

The visual style is **Corporate / Modern** with a lean toward **Minimalism**. By removing unnecessary visual noise and using a deep "Wealthy Greens" palette, the interface communicates prosperity and calm. The aesthetic relies on high-quality typography, generous white space (or "dark space" in this context), and subtle tonal shifts to guide the user's focus toward critical financial performance indicators.

## Colors

The palette is anchored by the **Wealthy Greens** spectrum, replacing traditional financial blues with tones associated with currency and growth. 

- **Primary (#007a33):** Used for primary actions, success states, and key growth indicators.
- **Secondary (#66b3a1):** A softer, minty-teal used for secondary data points, icons, and interactive hover states.
- **Tertiary (#004d00):** A deep forest green reserved for low-prominence backgrounds or subtle decorative borders.
- **Surface & Neutrals:** The UI uses a professional dark mode foundation. Backgrounds are a deep charcoal-black (#0a0c0a), while surfaces and containers use slightly elevated shades to create hierarchy.
- **Accents:** #b2e0d4 and #e0f7f1 provide high-contrast legibility for text on dark backgrounds or as highlight fills for charts and progress bars.

## Typography

The design system utilizes **Inter** exclusively to maintain a utilitarian, highly legible, and modern appearance. The type scale is optimized for data density.

Large display sizes use tighter letter spacing and heavier weights to command attention on dashboards. Body text remains neutral and rhythmic, ensuring long-form financial reports are easy to parse. Labels utilize a slight uppercase tracking to differentiate meta-data from primary content. On mobile, headlines scale down aggressively to ensure no more than three words are wrapped per line in standard viewport widths.

## Layout & Spacing

The system employs a **Fixed Grid** philosophy for desktop to maintain the precision expected in financial tools, switching to a **Fluid Grid** for mobile devices.

- **Desktop:** A 12-column grid with 24px gutters. Maximum container width is 1440px. Large margins (64px) help frame the data and reduce cognitive load.
- **Mobile:** A 4-column fluid grid with 16px margins.
- **Rhythm:** All spacing (padding, margins, gaps) follows a 4px base unit to ensure perfect alignment of tabular data and sparklines.

## Elevation & Depth

In this dark-themed environment, depth is communicated through **Tonal Layers** rather than heavy shadows.

- **Level 0 (Background):** Deepest shade (#0a0c0a).
- **Level 1 (Cards/Sections):** A slightly lighter charcoal (#161816) with a subtle 1px border using #004d00 at 30% opacity.
- **Level 2 (Modals/Popovers):** Elevated with a soft, diffused ambient shadow (0px 8px 24px rgba(0,0,0,0.5)) and a more prominent stroke.
- **Overlays:** Use a subtle backdrop blur (8px) to maintain context while focusing on the foreground task.

## Shapes

The shape language is **Rounded**, balancing the austerity of the dark mode with a touch of modern accessibility. 

Standard components like buttons and input fields utilize a 0.5rem (8px) radius. Larger containers and cards use 1rem (16px) to clearly define content groupings. This consistent rounding creates a friendly yet structured UI that avoids the aggressive feel of sharp corners.

## Components

- **Buttons:** Primary buttons use a solid #007a33 fill with white text. Secondary buttons use a #004d00 ghost style with a #66b3a1 stroke.
- **Inputs:** Fields are dark-filled with a subtle green-tinted border that glows (#007a33) when focused.
- **Chips:** Used for stock tickers or categories, employing #004d00 backgrounds with #b2e0d4 text for high legibility.
- **Data Visualization:** Charts should primarily use #007a33 for positive trends. Secondary data series should use #66b3a1. Area charts should utilize a gradient transition from #007a33 to transparent.
- **Progress Bars:** Track backgrounds use #004d00; the indicator uses #66b3a1 for a vibrant, "glowing" effect.
- **Lists:** Clean, border-bottom separated rows using #161816 with high-contrast text for values.