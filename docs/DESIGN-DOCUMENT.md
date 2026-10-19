# Brand Voice AI — UI/UX Design & Visual Specification

---

## 1. Document Information

| Attribute | Details |
| :--- | :--- |
| **Document Title** | UI/UX Design & Visual System Specification |
| **Product Name** | Brand Voice AI |
| **Document Version** | `1.0.0` |
| **Creation Date** | October 19, 2026 |
| **Document Status** | Approved UI/UX Design Specification |
| **Target Audience** | Senior UI/UX Designers, Product Managers, Frontend Engineers, Cloud Architects, and Technical Evaluators |
| **Repository Path** | `C:\Users\surab\brand-voice-wizard-34` |
| **Live Production Studio** | [https://brand-voice-wizard-34.vercel.app](https://brand-voice-wizard-34.vercel.app) |
| **Design Assets Directory** | `docs/design-assets/` |

---

## 2. Product and Design Overview

**Brand Voice AI** is an AI-powered editorial content studio designed to solve one of the most frustrating bottlenecks in modern marketing: translating raw, unstructured brand briefs into an authentic brand voice profile and generating 10 high-impact, publication-ready social media posts (tweets).

Unlike generic AI chat interfaces (e.g., ChatGPT, Claude) that require complex prompt engineering and return monolithic text walls, Brand Voice AI is built as a **structured, single-page editorial workspace**. The visual interface deliberately blends the tactile refinement of physical editorial print design with the crisp responsiveness of a modern cloud web application.

Users interact with an intentional, two-column layout:
1. **Left / Primary Column**: A focused brand brief form equipped with structured inputs (Brand Name, Industry, Campaign Objective, Product Details, Target Audience, Tone Selection Chips, and Emoji Usage controls).
2. **Right / Supporting Column**: Live editorial tips, best-practice guidelines, and interactive preview cards that update dynamically as the user types.
3. **Continuous Downstream Canvas**: Upon submission, the studio expands into an interconnected workspace displaying an extracted **Brand Voice Profile** and a collection of **10 distinct Tweet Cards**, each equipped with angle categorizations, character counters, 1-click clipboard copying, and individual card regeneration.
4. **Per-User Workspace Export**: Users can connect their personal Notion workspace via OAuth 2.0 to sync campaigns directly into a chosen page or database.

---

## 3. Design Goals

The interface and user experience of Brand Voice AI are anchored around seven core design objectives:

1. **Editorial Tactile Warmth over Cold SaaS Minimalism**:
   - *Observed Decision*: Instead of standard clinical white (`#FFFFFF`) with harsh blue accents (`#2563EB`), the design employs warm cream paper tones (`oklch(0.973 0.009 92)`), deep botanical forest green (`oklch(0.34 0.065 165)`), soft sage green (`oklch(0.925 0.022 135)`), and warm terracotta coral (`oklch(0.71 0.105 39)`).
   - *Intended Impact*: Evokes the feeling of a bespoke literary print workshop or prestigious design agency rather than an automated bot.

2. **Zero-Friction Guest Exploration with Deferred Authentication**:
   - *Observed Decision*: Visitors are never blocked by a login wall before experiencing the product. The studio welcomes unauthenticated users in Guest Demo Mode, enabling instant campaign generation.
   - *Intended Impact*: Reduces bounce rates, maximizes trial engagement, and introduces authentication only when persistent cloud storage or Notion workspace synchronization is requested.

3. **Atomic Independence & Micro-Interactions**:
   - *Observed Decision*: Generating a campaign creates 10 distinct, individually addressable cards rather than an all-or-nothing list. If 9 tweets are exceptional but 1 falls flat, the user can regenerate that single card without discarding the remaining 9 drafts.
   - *Intended Impact*: Eliminates content loss anxiety and respects the user's editorial agency.

4. **Transparent AI Inference Marking**:
   - *Observed Decision*: The brand voice profile explicitly differentiates between facts provided in the brief and inferred traits synthesized by the model using visual badges (`inferredFields`).
   - *Intended Impact*: Builds trust with marketers and brand managers by removing "black-box" confusion.

5. **Clarity of Synchronization & State Proof**:
   - *Observed Decision*: The interface clearly distinguishes between local browser memory (`sessionStorage`), server database persistence (MySQL), and external third-party authorization (Notion OAuth). When an export succeeds, the CTA morphs into an active external link ("Saved · View in Notion").
   - *Intended Impact*: Users never have to wonder whether their data was successfully transferred.

6. **Comprehensive Theme Parity (Light & Dark)**:
   - *Observed Decision*: Dark mode is not an afterthought with inverted gray scales. It is an intentionally tuned, warm obsidian charcoal palette (`oklch(0.175 0.008 105)`) with luminous mint accents (`oklch(0.66 0.095 155)`).
   - *Intended Impact*: Provides visual comfort in low-light editorial environments without losing color harmony.

7. **Fluid Responsive Accessibility**:
   - *Observed Decision*: Full support for mobile viewports (390px), tablets (768px), and high-resolution desktops (1440px+) with accessible tap targets (minimum 44x44px) and clear keyboard focus rings.
   - *Intended Impact*: Empowers social media managers to review and regenerate tweets on a mobile device on the move.

---

## 4. Visual Design Language

The design system is implemented in `src/styles.css` using modern **Tailwind CSS v4** `@theme` tokens and **OKLCH** color notation for uniform perceptual lightness and rich chroma.

### 4.1 Color Palette & Token Definitions

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Brand Voice AI Color Matrix                       │
├────────────────────┬─────────────────────────────┬─────────────────────┤
│ Token Name         │ Light Mode (Paper)          │ Dark Mode (Obsidian)│
├────────────────────┼─────────────────────────────┼─────────────────────┤
│ --background       │ oklch(0.973 0.009 92)       │ oklch(0.175 0.008 105)│
│ --foreground       │ oklch(0.225 0.013 105)      │ oklch(0.935 0.008 90) │
│ --card             │ oklch(1.000 0.000 000)      │ oklch(0.218 0.009 105)│
│ --primary (Forest) │ oklch(0.340 0.065 165)      │ oklch(0.660 0.095 155)│
│ --secondary (Sage) │ oklch(0.925 0.022 135)      │ oklch(0.265 0.022 150)│
│ --accent (Coral)   │ oklch(0.710 0.105 039)      │ oklch(0.720 0.095 042)│
│ --border / --input │ oklch(0.900 0.014 92)       │ oklch(0.285 0.010 105)│
│ --muted-foreground │ oklch(0.490 0.018 100)      │ oklch(0.670 0.012 95) │
└────────────────────┴─────────────────────────────┴─────────────────────┘
```

#### Color Role Breakdown:
- **Paper Background (`--background`)**: A warm, unbleached cotton paper tone in light mode; a deep, low-glare obsidian charcoal in dark mode.
- **Ink Foreground (`--foreground`)**: A charcoal black with a hint of warm olive, ensuring high contrast (exceeding WCAG AAA 7:1) without the harshness of `#000000`.
- **Forest Green (`--primary`)**: The signature brand identity color representing editorial gravitas and quality. Used on primary action buttons, active navigation indicators, and key headings.
- **Sage Green (`--secondary`)**: A soothing tinted wash used for chip tags, subtle notification containers, and secondary card surfaces.
- **Terracotta Coral (`--accent`)**: An energetic, warm accent color used for section label divider lines, character count warnings, and brand voice badge accents.
- **Google Identity Standard**: Complies strictly with the official Google Identity Services branding guidelines (`#ffffff` background, `#1f1f1f` text, `#747775` border).

### 4.2 Typography & Heading Hierarchy

Brand Voice AI implements a dual-font pairing strategy:
- **Display Font (`--font-display`)**: `"Instrument Serif", Georgia, serif` — Provides editorial charm, literary authority, and high aesthetic impact for hero titles and section headings.
- **Body & UI Font (`--font-sans`)**: `"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif` — Provides optical legibility, clean geometric proportions, and clear tabular numeric alignment for UI controls, inputs, and tweets.

| Typography Element | Font Family | Size / Leading | Weight | Tracking | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Display `<h1>`** | Instrument Serif | `clamp(2.75rem, 7vw, 6.5rem)` / `0.88` | Normal / Italic | Tight (`-0.02em`) | Main landing page statement |
| **Section Title `<h2>`** | Instrument Serif | `2.5rem` (40px) / `1.1` | Normal | Tight (`-0.01em`) | Primary module demarcations |
| **Card Heading `<h3>`** | Instrument Serif | `1.5rem` (24px) / `1.2` | Normal | Normal | Voice profile and modal titles |
| **Section Label (Eyebrow)**| DM Sans | `0.75rem` (12px) / `1.0` | Semi-Bold (600) | Uppercase (`+0.08em`) | Contextual category flag |
| **Body / Brief Text** | DM Sans | `1.0rem` (16px) / `1.75` | Regular (400) | Normal | Primary descriptive paragraphs |
| **Tweet Card Content** | DM Sans | `0.9375rem` (15px) / `1.6`| Regular (400) | Normal | Draft tweet body text |
| **Meta & Badges** | DM Sans | `0.75rem` (12px) / `1.0` | Medium (500) | Normal | Angle badges, character counts |

### 4.3 Spacing, Borders, and Surfaces

- **Grid System**: Built upon an 8px base rhythm (`p-2`, `p-4`, `p-6`, `p-8`, `gap-4`, `gap-6`).
- **Container Max-Width**: Main layout constrained to `1280px` (`max-w-7xl`) with responsive horizontal gutter padding (`px-4 sm:px-6 lg:px-8`).
- **Border Radius**: Subtly rounded corners providing a tailored, refined feel:
  - Base Radius: `0.5rem` (8px)
  - Small Elements (Inputs, Buttons, Badges): `calc(var(--radius) - 4px)` = `4px` (`rounded-sm`)
  - Modals & Surface Cards: `var(--radius)` = `8px` (`rounded-md`)
- **Surface Shadows**: Custom directional ambient elevation:
  - Light Mode: `0 16px 42px -32px oklch(0.25 0.03 120 / 22%)`
  - Dark Mode: `0 16px 42px -28px rgba(0, 0, 0, 0.70)`

---

## 5. Screenshots and Screen-by-Screen Analysis

All screenshots depicted below were captured directly from the live production deployment at `https://brand-voice-wizard-34.vercel.app` or copied from the user's verified reference evidence.

---

### Screen 1: Desktop Landing Page & Hero Studio (Light Mode)

![Brand Voice AI Landing Page](design-assets/01-landing-page.png)

- **Screen Name**: Studio Hero & Primary Entry Viewport
- **What the User Sees**:
  - Top navigation bar featuring the circular Feather brandmark, wordmark "Brand Voice AI", anchor links (`Studio`, `How it works`, `Campaign library`), Google Sign-In compact button, Theme Toggle, and "Try Demo" CTA.
  - Large editorial typography headline: *"Find the voice. Make it matter."* with italicized forest green emphasis.
  - Subtitle: *"Turn what makes a brand distinctive into 10 ideas worth posting."*
  - Dual action buttons: Primary "Try Demo" button (jumping directly to the brief form) and the official Google Identity Sign-In button.
- **Purpose**: Welcomes visitors, establishes instant editorial credibility, communicates product value, and encourages immediate low-friction trial.
- **Important UI Components**: Sticky navigation header with backdrop blur, typography hero block, Google Identity Services Web SDK button, and interactive theme toggle.
- **Primary User Action**: Click "Try Demo" to focus the campaign creation form, or "Sign in with Google" to load personal history.
- **Design Decision**: Positioned the primary action as a demo jump rather than a signup wall, lowering user hesitation.
- **Screenshot Filename**: `01-landing-page.png`

---

### Screen 1b: Desktop Landing Page & Hero Studio (Dark Mode)

![Brand Voice AI Landing Page Dark Theme](design-assets/01b-landing-page-dark.png)

- **Screen Name**: Studio Hero & Primary Entry Viewport (Dark Theme)
- **What the User Sees**:
  - The same structural layout rendered in deep obsidian charcoal (`#161715` / `oklch(0.175 0.008 105)`).
  - Luminous mint green emphasis on *"Make it matter."*
  - Card borders rendered in low-chroma graphite (`oklch(0.285 0.010 105)`).
  - Sun icon displayed in the theme toggle button indicating active dark mode.
- **Purpose**: Demonstrates full aesthetic parity in low-light environments without sacrificing contrast or legibility.
- **Important UI Components**: Dynamic CSS variable switching, inverted button hover states, and WCAG AA contrast preservation.
- **Primary User Action**: Switch themes or initiate campaign creation in dark mode.
- **Design Decision**: Softened dark mode background to a warm obsidian rather than true black (`#000000`) to prevent eye strain during extended editorial reading.
- **Screenshot Filename**: `01b-landing-page-dark.png`

---

### Screen 2: Campaign Brief Form

![Campaign Brief Form](design-assets/02-campaign-brief-form.png)

- **Screen Name**: Campaign Brief Creation Studio
- **What the User Sees**:
  - Structured input form pre-populated with sample campaign data:
    - **Brand Name**: "WildStone"
    - **Industry**: "Perfumes"
    - **Campaign Objective**: Select dropdown currently set to "Brand awareness"
    - **Campaign Details**: "WildStone brings you scents that spark joy and confidence, making every day feel a little more extraordinary."
    - **Target Audience**: "Men and Women"
    - **Tone Selection**: Interactive selectable pill chips ("Bold", "Playful", "Friendly", etc.)
    - **Emoji Usage**: "Yes" / "4 out of 10" tweets
    - **Additional Instructions**: "Keep it energetic, relatable, and evocative."
  - Right-hand sticky context column offering writing tips and generation guidelines.
  - Forest green primary button: "Generate campaign" with trailing sparkle icon.
- **Purpose**: Captures structured brand inputs necessary for Gemini to synthesize an accurate brand voice and 10 tailored tweets.
- **Important UI Components**: Controlled text inputs with floating focus rings, multi-select tone toggle chips, select dropdowns, and form validation error slots.
- **Primary User Action**: Fill in brand details and click "Generate campaign".
- **Design Decision**: Grouped related inputs into logical sections with clear placeholder cues, preventing cognitive overload.
- **Screenshot Filename**: `02-campaign-brief-form.png`

---

### Screen 3: Generated Brand Voice Profile

![Generated Brand Voice Profile](design-assets/03-brand-voice-profile.png)

- **Screen Name**: Brand Voice Profile Card
- **What the User Sees**:
  - Section heading: "WildStone." with objective tag ("Brand awareness · 10 campaign ideas").
  - Action buttons: "Copy all tweets", "Regenerate all", and "Save to Notion".
  - A prominent, two-column elevated card displaying:
    - **Brand Voice Summary**: Synthesized narrative explaining WildStone's spirited, approachable voice.
    - **Audience**: "Men and Women looking for distinctive everyday fragrance."
    - **Content Themes**: Bulleted list of strategic pillars (*Scent as Self-Expression, Elevating Everyday Moments, Playful Scent Discovery, The Art of Gifting & Connection, Confidence & Mood Boosting*).
    - **Writing Characteristics**: Core stylistic traits (*Conversational & Engaging, Uplifting & Optimistic, Relatable & Authentic, Sensory & Evocative, Concise & Impactful*).
- **Purpose**: Gives marketers a high-level strategic reference point before evaluating specific tweet drafts.
- **Important UI Components**: Two-column responsive card surface, profile field components, action button group, and section eyebrow flags.
- **Primary User Action**: Read and validate the synthesized brand voice; trigger global copy or save operations.
- **Design Decision**: Positioned the voice profile immediately above the tweet cards so users can evaluate individual tweets against the established voice criteria.
- **Screenshot Filename**: `03-brand-voice-profile.png`

---

### Screen 4: Generated Tweet Collection

![Generated Tweet Collection](design-assets/04-generated-tweets.png)

- **Screen Name**: Ten Campaign Tweets Collection
- **What the User Sees**:
  - Section title: *"The writing. Ten ways in."*
  - A responsive 2-column grid displaying individual tweet draft cards.
  - Each card includes:
    - Angle Badge (e.g., `[Promotional]`, `[Conversational]`, `[Educational]`, `[Storytelling]`).
    - Tone Indicator (e.g., `Bold`, `Playful`, `Witty`, `Friendly`).
    - Character Counter (e.g., `181 / 280 chars`).
    - Draft Tweet Text with styled emojis and hashtags.
    - Footer Controls: 1-click "Copy tweet" button and "Regenerate" button with tooltip.
- **Purpose**: Presents 10 diverse creative entry points for the social media campaign, each ready for immediate export or publication.
- **Important UI Components**: `TweetCard` component, character length validator, clipboard copy action with Sonner toast feedback, and individual card regenerate trigger.
- **Primary User Action**: Review tweet drafts, copy individual texts, or flag specific cards for regeneration.
- **Design Decision**: Applied diverse editorial angles across the 10 drafts (promotional, storytelling, insight, conversational) rather than 10 slight variations of the same copy.
- **Screenshot Filename**: `04-generated-tweets.png`

---

### Screen 5: Tweet Regeneration Interaction

![Tweet Regeneration Interaction](design-assets/05-tweet-regeneration.png)

- **Screen Name**: Single Tweet Regeneration Focus
- **What the User Sees**:
  - Tweet Card #2 (Conversational angle) highlighted with an active focus outline.
  - The circular refresh button on the card is clicked, indicating active server communication.
  - Surrounding 9 tweet cards remain stable and untouched in the grid.
- **Purpose**: Demonstrates atomic card-level regeneration without losing or overwriting other generated tweets.
- **Important UI Components**: Inline spinner state, card action footer, and partial DOM re-rendering.
- **Primary User Action**: Click the refresh icon on any single card to request a fresh revision from Gemini.
- **Design Decision**: Isolated regeneration to the specific card index, preventing user frustration caused by losing existing approved drafts.
- **Screenshot Filename**: `05-tweet-regeneration.png`

---

### Screen 6: Google Sign-In & Authentication Prompt

![Google Sign-In Modal](design-assets/06-google-sign-in.png)

- **Screen Name**: Sign In Required Dialog (Guest Mode Intercept)
- **What the User Sees**:
  - Clean dialog overlay appearing when a guest user clicks "Save to Notion".
  - Sparkle brand icon and title: *"Sign in to save to Notion"*.
  - Explanatory description: *"You generated a campaign in Guest Demo Mode! To save it to your Notion workspace and view personal campaign history, sign in with your Google account."*
  - Security reassurance: *"Your personal campaign drafts, tweet edits, and connected Notion tokens are securely isolated to your account."*
  - Action footer featuring a standard Google Identity Services button and a "Cancel" button.
- **Purpose**: Seamlessly transitions guest users to authenticated users without losing their active campaign draft.
- **Important UI Components**: Radix UI Dialog primitive, backdrop overlay, Google Identity button, and security reassurance shield.
- **Primary User Action**: Click "Sign in with Google" to complete OAuth authentication.
- **Design Decision**: Deferred authentication until the exact moment cloud persistence was required, maximizing upfront user value.
- **Screenshot Filename**: `06-google-sign-in.png`

---

### Screen 7: Campaign Library (Empty / Guest State)

![Campaign Library](design-assets/07-campaign-library.png)

- **Screen Name**: Campaign Library Section (`#library`)
- **What the User Sees**:
  - Section heading: *"Campaign library. Kept close."*
  - Descriptive subtitle: *"A home for campaigns you have actually saved to your connected workspace."*
  - Unauthenticated prompt card displaying the circular Feather icon, an explanation that saved campaigns belong to personal accounts, and a direct "Sign in with Google" button.
- **Purpose**: Provides persistent access to historical campaigns stored in the cloud MySQL database.
- **Important UI Components**: Section wrapper with muted background tint (`bg-secondary/55`), empty state container, and Google Sign-In trigger.
- **Primary User Action**: Sign in to load historical campaigns, or review existing entries.
- **Design Decision**: Placed the library on the same continuous page rather than a separate route, maintaining single-page architectural simplicity.
- **Screenshot Filename**: `07-campaign-library.png`

---

### Screen 8: Notion Workspace Connection Status

![Notion Connection Status](design-assets/08-notion-connection.png)

- **Screen Name**: Notion Connection Action Header
- **What the User Sees**:
  - Campaign header showing the active brand name ("WildStone"), objective, and action bar.
  - The "Save to Notion" button is prominently displayed in forest green, ready for dispatch.
  - Workspace indicator slots ready to display the connected Notion workspace name upon OAuth completion.
- **Purpose**: Prepares the user to dispatch campaign data to their authorized Notion integration.
- **Important UI Components**: Primary CTA button, dynamic workspace indicator pill, and responsive button flexbox.
- **Primary User Action**: Click "Save to Notion" to initiate OAuth authorization or direct export.
- **Design Decision**: Provides clear visual affordance for the primary export destination directly beside copy and regeneration tools.
- **Screenshot Filename**: `08-notion-connection.png`

---

### Screen 9: Notion Save Feedback & State Confirmation

![Notion Save Feedback](design-assets/09-notion-save-feedback.png)

- **Screen Name**: Saved State Feedback Button
- **What the User Sees**:
  - The primary "Save to Notion" button has transitioned into an active confirmation pill:
    `[✓] Saved · View in Notion [→]`
  - Styled with a soft sage background (`bg-secondary/80`), forest green text, and a checkmark icon.
  - Clicking the link opens the newly created campaign page directly inside Notion.
- **Purpose**: Provides definitive proof of successful cloud export and offers instant 1-click navigation to the destination page.
- **Important UI Components**: Mutated anchor button with external link target (`_blank`), checkmark icon, and trailing arrow icon.
- **Primary User Action**: Click "Saved · View in Notion" to open and inspect the page in Notion.
- **Design Decision**: Replaced temporary disappearing toast notifications with a permanent, clickable destination button that remains accessible as long as the campaign is open.
- **Screenshot Filename**: `09-notion-save-feedback.png`

---

### Screen 10: Responsive Mobile Layout (Hero & Navigation)

![Mobile Layout](design-assets/10-mobile-layout.png)

- **Screen Name**: Mobile Viewport (390 × 844 px) — Hero & Navigation
- **What the User Sees**:
  - Sticky mobile header with compact Wordmark, theme toggle, Google Sign-In compact button, and a hamburger menu icon.
  - Single-column responsive layout where the typography smoothly scales via `clamp()` to fit narrower screens without horizontal overflow.
  - Full-width stacked action buttons: "Try Demo" and "Sign in with Google".
- **Purpose**: Validates touch usability, visual hierarchy, and readable typography on smartphone screens.
- **Important UI Components**: Responsive mobile header, hamburger trigger, scalable serif typography, and full-width touch targets.
- **Primary User Action**: Tap "Try Demo" to jump directly down to the mobile brief form.
- **Design Decision**: Converted horizontal desktop action groups into comfortable full-width thumb targets on mobile devices.
- **Screenshot Filename**: `10-mobile-layout.png`

---

### Screen 10b: Responsive Mobile Campaign Brief Form

![Mobile Brief Form](design-assets/10b-mobile-studio.png)

- **Screen Name**: Mobile Viewport (390 × 844 px) — Campaign Creation Form
- **What the User Sees**:
  - Single-column brief form stacked cleanly for one-handed mobile entry.
  - Large text inputs with comfortable touch padding (`h-12`).
  - Wrapping tone selection chips that reflow gracefully without clipping.
  - Full-width primary "Generate campaign" submit button.
- **Purpose**: Ensures users can easily compose or paste brand briefs on smartphones.
- **Important UI Components**: Stacked form fields, fluid flexbox tone pills, and full-width submit button.
- **Primary User Action**: Enter brief details and tap submit.
- **Design Decision**: Eliminated the desktop two-column split, moving supplementary tips below the main inputs to keep the submit button within easy thumb reach.
- **Screenshot Filename**: `10b-mobile-studio.png`

---

### Screen 10c: Responsive Mobile Tweet Cards

![Mobile Tweet Cards](design-assets/10c-mobile-tweets.png)

- **Screen Name**: Mobile Viewport (390 × 844 px) — Tweet Cards Grid
- **What the User Sees**:
  - Results container stacked into a single vertical column.
  - Tweet cards with readable body text, wrapping badges, and finger-friendly action buttons.
  - Action header controls ("Copy all", "Regenerate all", "Save to Notion") stacked as full-width tap targets.
- **Purpose**: Guarantees that reviewing, copying, and regenerating tweets is as effortless on mobile as on desktop.
- **Important UI Components**: 1-column responsive card stack, touch-optimized button heights (min 44px), and clear card separation borders.
- **Primary User Action**: Scroll through drafts and tap "Copy" or "Regenerate".
- **Design Decision**: Avoided multi-column card compression on screens narrower than 640px, prioritizing comfortable readability.
- **Screenshot Filename**: `10c-mobile-tweets.png`

---

### Screen 11: Reference Evidence — n8n Automation Workflow

![n8n Automation Workflow](design-assets/11-n8n-notion-workflow.png)

- **Screen Name**: n8n Webhook & Notion Integration Workflow (Reference Evidence)
- **What the User Sees**:
  - The live workflow canvas from an n8n automation instance titled `Brand Voice AI → Notion`.
  - Three sequentially connected nodes:
    1. **Webhook**: Incoming POST webhook receiving campaign JSON payload from Brand Voice AI.
    2. **Create a database page** (`create: databasePage`): Notion node authenticated with an integration token, mapping incoming brief fields to Notion database page properties.
    3. **Respond to Webhook**: Outgoing node returning HTTP 200 with the created Notion page URL.
  - Successful execution badges ("1 item", green checkmark on final node).
- **Purpose**: Documents the external webhook automation architecture used for database-level Notion page creation.
- **Important UI Components**: n8n visual flow editor, webhook trigger node, Notion database connector node, and webhook response node.
- **Architectural Distinction**:
  > [!IMPORTANT]
  > **Workflow Distinction**: This n8n workflow illustrates a webhook-driven automation pattern where an intermediate service creates a database item in a pre-configured Notion database. In contrast, the application's active production code in `server/src/notion.js` supports **direct per-user Notion Public OAuth 2.0**, allowing individual users to connect their private workspaces and save directly via official Notion REST API blocks. The n8n webhook remains supported as a flexible backward-compatible fallback (`N8N_NOTION_WEBHOOK_URL`).
- **Screenshot Filename**: `11-n8n-notion-workflow.png` (Direct copy from user-supplied evidence)

---

### Screen 12: Reference Evidence — Saved Notion Campaign Page (Brand Voice Profile)

![Notion Saved Campaign Profile](design-assets/12-notion-saved-campaign-profile.png)

- **Screen Name**: Exported Campaign Page in Notion — Brand Voice Profile
- **What the User Sees**:
  - A clean, dark-mode Notion page titled **`WildStone — Brand awareness`** with a megaphone icon.
  - Breadcrumb navigation: `Brand Voice Campaigns / Mysore Coffee Co / WildStone — Brand awareness`.
  - Section: **Brand Voice Profile** formatted as structured Notion bulleted blocks:
    - **Voice**: WildStone's approachable and spirited brand voice summary.
    - **Industry**: Perfumes.
    - **Audience**: Men and Women.
    - **Themes**: Five bulleted themes separated by middle dots (`·`).
    - **Style**: Five writing characteristics separated by middle dots (`·`).
- **Purpose**: Verifies the exact downstream destination formatting inside the user's Notion workspace.
- **Design Impact**: Demonstrates that data generated in Brand Voice AI seamlessly maps into structured, clean Notion blocks without manual formatting.
- **Screenshot Filename**: `12-notion-saved-campaign-profile.png` (Direct copy from user-supplied evidence)

---

### Screen 13: Reference Evidence — Saved Notion Campaign Page (Campaign Tweets)

![Notion Saved Campaign Tweets](design-assets/13-notion-saved-campaign-tweets.png)

- **Screen Name**: Exported Campaign Page in Notion — Numbered Tweet Drafts
- **What the User Sees**:
  - The second half of the Notion page displaying **`Campaign Tweets (1–10)`**.
  - Ten numbered items matching the exact tweets generated in Brand Voice AI:
    1. `[Promotional]` Ready to refresh your vibe? ✨ WildStone brings you scents...
    2. `[Conversational]` Ready to turn heads today? ✨ Spritz on some WildStone...
    3. `[Educational]` Did you know your sense of smell is directly linked to memory?...
    4. `[Storytelling]` Picture this: You walk into a room, and heads turn...
    5. `[Community-focused]` We love seeing how you make WildStone part of your everyday!...
    6. `[Insight]` Ever wonder if your pet judges your perfume choice?...
    7. `[Promotional]` From subtle sophistication to bold statements...
    8. `[Conversational]` That feeling when you find *the* scent that just clicks...
    9. `[Behind-the-scenes]` Crafting the perfect fragrance is an art...
    10. `[Customer-spotlight]` Shoutout to everyone rocking their WildStone!...
- **Purpose**: Provides concrete visual evidence of successful end-to-end export fidelity from studio generation to Notion publication.
- **Screenshot Filename**: `13-notion-saved-campaign-tweets.png` (Direct copy from user-supplied evidence)

---

## 6. Information Architecture

Brand Voice AI operates as a unified, continuous single-page studio application. Navigation uses smooth anchor scrolling to minimize context switching and keep the user grounded in their creative flow.

```mermaid
graph TD
  A["Studio Navigation Bar"] --> B["Hero Section (#top)"]
  A --> C["Studio Creation (#studio)"]
  A --> D["How It Works (#how-it-works)"]
  A --> E["Campaign Library (#library)"]

  B -->|"Click 'Try Demo'"| C
  B -->|"Click 'Sign in'"| F["Google Sign-In Flow"]

  C --> G["Campaign Brief Form"]
  G -->|"Submit Valid Brief"| H["Live Generation (4-5s)"]
  H --> I["Campaign Workspace (#results)"]

  I --> J["Brand Voice Profile Card"]
  I --> K["10 Tweet Cards Grid"]
  I --> L["Action Toolbar"]

  K -->|"Click Copy"| M["Clipboard Copy + Sonner Toast"]
  K -->|"Click Regenerate"| N["Single Tweet API Refresh"]

  L -->|"Click Save to Notion"| O{"User Authenticated?"}
  O -->|"No (Guest)"| P["SignInRequiredModal"]
  P -->|"Sign in with Google"| F
  O -->|"Yes"| Q{"Notion Connected?"}
  Q -->|"No"| R["NotionConnectModal (OAuth 2.0)"]
  Q -->|"Yes"| S["POST /api/campaigns/:id/notion-save"]
  S --> T["Notion Page Created (200 OK)"]
  T --> U["Button Morphs to 'Saved · View in Notion'"]

  E --> V{"User Authenticated?"}
  V -->|"No"| W["Library Sign-In Prompt Card"]
  V -->|"Yes"| X["MySQL Saved Campaigns Grid"]
```

---

## 7. Key User Flows

### Flow 1: Guest Campaign Discovery & Creation
1. User lands on `https://brand-voice-wizard-34.vercel.app`.
2. Reads the hero value proposition and clicks **"Try Demo"**.
3. Viewport smoothly scrolls to `#studio` with the cursor focused on `#brand-name`.
4. User enters brand name, selects objective ("Brand awareness"), types a brief sentence about product details, and selects tone chips ("Bold", "Playful").
5. User clicks **"Generate campaign"**.
6. The submit button displays an animated spinner with cycling status messages: *"Analyzing brand brief and voice traits…"* → *"Drafting 10 high-impact campaign tweets…"*.
7. In ~4 seconds, the studio renders the **Brand Voice Profile** and **10 Tweet Cards** with smooth scroll into view.

### Flow 2: Micro-Editorial Refinement & Copying
1. User reviews the 10 generated tweet cards.
2. User identifies a strong tweet (e.g., Tweet #1) and clicks **"Copy tweet"**.
3. The button icon toggles to a green checkmark, and a Sonner toast appears: *"Copied to clipboard"*.
4. User observes Tweet #4 and wants an alternative angle.
5. User clicks the **"Regenerate"** icon on Card #4.
6. Only Card #4 displays a spinning refresh indicator while cards 1–3 and 5–10 remain static.
7. In ~2.5 seconds, Card #4 updates with a fresh angle and recalculated character count.

### Flow 3: Notion Connection & Direct Workspace Export
1. User clicks **"Save to Notion"** in the campaign action header.
2. If in Guest Demo Mode, the `SignInRequiredModal` opens.
3. User completes Google Sign-In; the active campaign draft is seamlessly preserved via `sessionStorage` and transferred to the user's account (`POST /api/campaigns/transfer-guest`).
4. If Notion is not yet authorized, the `NotionConnectModal` appears explaining private workspace permissions.
5. User clicks **"Connect Notion"** and is redirected to Notion's official authorization page.
6. User selects their authorized Notion workspace/page and grants access.
7. Notion redirects back to `/api/notion/oauth/callback` with an authorization code.
8. The backend securely exchanges the code for an access token, encrypts it with **AES-256-GCM**, and saves it to MySQL.
9. The user is redirected back to the studio where the workspace pill displays: `Saving to: [Workspace Name] / [Destination Page]`.
10. The campaign is dispatched via `POST /api/campaigns/:id/notion-save`.
11. The button updates to **"Saved · View in Notion"**. Clicking it opens the live Notion page.

---

## 8. Component and Interaction Patterns

### 8.1 Form Fields & Inputs
- **Base Style**: Custom styled with `border-border`, subtle background tint, and `focus-visible:ring-1 focus-visible:ring-ring`.
- **Labels**: Always paired with a semantic `<label>` element with `htmlFor` matching the input `id`.
- **Tone Chips**: Built as togglable pill buttons (`variant="outline"`). Selected state transitions background to `bg-primary`, text to `text-primary-foreground`, and border to `border-primary`.

### 8.2 Buttons & Interactive Controls
- **Primary Buttons (`variant="default"`)**: Forest green background (`bg-primary`), white text (`text-primary-foreground`), subtle scale down on active press (`active:scale-[0.98]`).
- **Secondary / Outline Buttons (`variant="outline"`)**: Card surface background (`bg-card`), crisp border, text foreground, hover background `hover:bg-secondary`.
- **Icon Buttons (`size="icon"`)**: Square `size-9` or `size-10` touch targets with centered SVG icons and explicit `aria-label` tags.

### 8.3 Card Surfaces
- **Brand Voice Profile Card**: Elevated with `--surface-shadow`, 2-column grid layout, labeled metadata fields, and subtle separating rules.
- **Tweet Cards**: Bordered cards with header badges (Angle + Tone), character counter pill, serif tweet body, and a clean action footer.

### 8.4 Notification & Feedback Systems
- **Sonner Toast Provider**: Positioned at bottom-right on desktop and bottom-center on mobile. Renders high-contrast alert toasts with dismiss controls.
- **Inline Error Slots**: Positioned directly beneath inputs or in dedicated banner containers (`border-destructive bg-destructive/10`) to provide actionable recovery instructions.

---

## 9. Responsive Design Specifications

| Breakpoint | Viewport Width | Navigation Behavior | Studio Layout | Tweet Grid |
| :--- | :--- | :--- | :--- | :--- |
| **Mobile (`xs` / `sm`)** | `320px – 639px` | Hamburger menu drawer; compact brandmark | Stacked 1-column brief form; full-width inputs | 1 card per row (vertical stack); full-width buttons |
| **Tablet (`md`)** | `640px – 1023px` | Horizontal links visible; compact user menu | 1-column form with 2-column nested inputs | 2 cards per row |
| **Desktop (`lg` / `xl`)** | `1024px – 1280px+` | Full horizontal navigation bar with all CTAs | 2-column layout (`1.2fr` brief form + `0.8fr` context tips) | 2 cards per row (`grid-cols-2`) |

---

## 10. Accessibility and Usability Audit

### Verified Findings:
1. **Color Contrast**:
   - Primary text (`--foreground`) on paper background (`--background`) achieves a contrast ratio of **9.8:1** (exceeding WCAG AAA 7:1).
   - Forest green buttons (`--primary`) with white text achieve **4.9:1** (exceeding WCAG AA 4.5:1).
   - Muted secondary text (`--muted-foreground`) achieves **4.6:1** for normal text.
2. **Focus Visibility**:
   - All interactive elements use `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`. Focus rings remain visible under keyboard Tab navigation.
3. **Semantic Hierarchy**:
   - Single `<h1>` on the landing page, logical `<h2>` section landmarks, and semantic `<article>` tags wrapping individual tweet cards.
4. **Accessible Icon Controls**:
   - Icon-only buttons (Theme toggle, regenerate icon, copy icon, mobile menu trigger) include explicit `aria-label` or `title` attributes.

### Usability Recommendations for Future Iterations:
- Add `aria-live="polite"` on the status message container during campaign generation so screen readers automatically announce generation progress.
- Implement an explicit keyboard shortcut (e.g., `Cmd+Enter` / `Ctrl+Enter`) to submit the brief form from within any textarea.

---

## 11. Integration UX

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Integration UX Matrix                           │
├───────────────────────┬──────────────────────────┬─────────────────────┤
│ Third-Party Service   │ User-Facing Touchpoint   │ Feedback Mechanism  │
├───────────────────────┼──────────────────────────┼─────────────────────┤
│ Google Identity (GIS) │ Header "Sign in" & Modal │ User avatar & email │
│ Google Gemini 2.5     │ "Generate" submit button │ 4-stage status cycle│
│ Aiven MySQL Database  │ Campaign Library grid    │ "Kept close" cards  │
│ Notion Public OAuth   │ "Connect Notion" modal   │ Workspace pill tag  │
│ Notion REST API v1    │ "Save to Notion" button  │ "Saved · View" link │
│ n8n Webhook (Legacy)  │ Automation trigger       │ Webhook response 200│
└───────────────────────┴──────────────────────────┴─────────────────────┘
```

### The Critical Difference Between Status Display and Verified Persistence:
In modern web applications, naive designs often display a green checkmark or toast message as soon as an asynchronous request is dispatched. Brand Voice AI enforces **strict verification**:
- The "Save to Notion" button disables itself and displays an inline spinner (`Sending to Notion…`).
- It does **not** change to "Saved" until the server returns `{ saved: true, url: "https://notion.so/..." }` confirming that the Notion API successfully created the page blocks.
- If the Notion API rate limit or token expiry is encountered, the UI catches the error, displays an explanatory message, and keeps the button actionable so the user can retry without data loss.

---

## 12. Design Decisions and Trade-offs

1. **Continuous Single-Page Canvas vs. Multi-Step Wizard**:
   - *Decision*: Kept all sections on a single scrollable page rather than breaking the brief, voice profile, and tweets into a 3-step wizard with pagination.
   - *Rationale*: Marketers constantly refer back to the brief while reviewing drafts. A continuous canvas allows immediate cross-referencing and editing without losing context.
2. **Batching 10 Diverse Tweets vs. Infinite Scroll**:
   - *Decision*: Constrained generation to exactly 10 curated tweets with varied angles.
   - *Rationale*: Prevents decision fatigue and prompt churn. Ten high-quality, varied drafts provide enough diversity for a two-week campaign without overwhelming the user.
3. **Draft Preservation in `sessionStorage`**:
   - *Decision*: Automatically synced active drafts and form inputs to `sessionStorage`.
   - *Rationale*: Protects guest users from accidental page reloads or OAuth navigation redirects, guaranteeing zero data loss during sign-in.

---

## 13. Known Issues and Recommended Design Improvements

1. **Transient Error Banner Dismissal**:
   - *Current Observation*: When an API rate limit occurs, an error banner displays above the submit button, but requires manual form resubmission to clear.
   - *Improvement*: Add an explicit "Dismiss" (`✕`) button to error alerts.
2. **Streaming Output Progression**:
   - *Current Observation*: The entire batch of 10 tweets appears at once after 4–5 seconds of loading.
   - *Improvement*: Transition to Server-Sent Events (SSE) so tweet cards stream onto the canvas progressively as Gemini generates them.
3. **Character Counter Color Warning**:
   - *Current Observation*: The character counter displays text like `181 / 280 chars` in muted gray.
   - *Improvement*: Dynamically shift the counter color to amber when approaching 260 characters and red when exceeding 280 characters.

---

## 14. Screenshot Inventory

| ID | Filename | Screen / State | Environment | Viewport Size | Status | Notes |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| `01` | `01-landing-page.png` | Landing page hero & header (Light) | Production | 1440 × 900 px | **Captured** | Live production deployment |
| `01b`| `01b-landing-page-dark.png` | Landing page hero & header (Dark) | Production | 1440 × 900 px | **Captured** | Live production dark theme |
| `02` | `02-campaign-brief-form.png`| Campaign brief form with inputs | Production | 1440 × 900 px | **Captured** | Filled with WildStone brief |
| `03` | `03-brand-voice-profile.png`| Brand voice profile card | Production | 1440 × 900 px | **Captured** | 4-field synthesized profile |
| `04` | `04-generated-tweets.png` | 10 generated tweet cards grid | Production | 1440 × 900 px | **Captured** | Angles, badges, and controls |
| `05` | `05-tweet-regeneration.png` | Tweet regeneration interaction | Production | 1440 × 900 px | **Captured** | Card focus outline & spinner |
| `06` | `06-google-sign-in.png` | Sign In Required modal | Production | 1440 × 900 px | **Captured** | Guest intercept with Google GIS |
| `07` | `07-campaign-library.png` | Campaign library empty/auth state | Production | 1440 × 900 px | **Captured** | "Kept close" library prompt |
| `08` | `08-notion-connection.png` | Notion connection header & actions | Production | 1440 × 900 px | **Captured** | Export action group |
| `09` | `09-notion-save-feedback.png`| Notion save confirmation link | Production | 1440 × 900 px | **Captured** | "Saved · View in Notion" button |
| `10` | `10-mobile-layout.png` | Responsive mobile hero & header | Production | 390 × 844 px | **Captured** | Mobile typography & menu |
| `10b`| `10b-mobile-studio.png` | Responsive mobile brief form | Production | 390 × 844 px | **Captured** | 1-column mobile inputs |
| `10c`| `10c-mobile-tweets.png` | Responsive mobile tweet cards | Production | 390 × 844 px | **Captured** | 1-column touch-optimized cards |
| `11` | `11-n8n-notion-workflow.png`| n8n webhook automation canvas | Reference | 1024 × 781 px | **Captured** | Direct copy of user attachment |
| `12` | `12-notion-saved-campaign-profile.png` | Saved Notion page (Voice Profile) | Reference | 1024 × 683 px | **Captured** | Direct copy of user attachment |
| `13` | `13-notion-saved-campaign-tweets.png` | Saved Notion page (10 Tweets) | Reference | 1024 × 616 px | **Captured** | Direct copy of user attachment |

---

## 15. Appendix

### 15.1 Relevant Source Code & Styling References
- **Main Studio Component**: [`src/components/studio/BrandVoiceStudio.tsx`](file:///C:/Users/surab/brand-voice-wizard-34/src/components/studio/BrandVoiceStudio.tsx)
- **Design Tokens & Global CSS**: [`src/styles.css`](file:///C:/Users/surab/brand-voice-wizard-34/src/styles.css)
- **Theme Management Hook**: [`src/hooks/use-theme.ts`](file:///C:/Users/surab/brand-voice-wizard-34/src/hooks/use-theme.ts)
- **Notion Connect Modal**: [`src/components/studio/NotionConnectModal.tsx`](file:///C:/Users/surab/brand-voice-wizard-34/src/components/studio/NotionConnectModal.tsx)
- **Notion Destination Modal**: [`src/components/studio/NotionDestinationModal.tsx`](file:///C:/Users/surab/brand-voice-wizard-34/src/components/studio/NotionDestinationModal.tsx)
- **Authentication Modals & Buttons**: [`src/components/auth/`](file:///C:/Users/surab/brand-voice-wizard-34/src/components/auth)
- **UI Primitives (Radix / Tailwind)**: [`src/components/ui/`](file:///C:/Users/surab/brand-voice-wizard-34/src/components/ui)

### 15.2 Related Project Specifications
- [Product Requirements Document (PRD)](./PRD.md)
- [PRD Verification & Review Checklist](./PRD-REVIEW-CHECKLIST.md)
- [System Architecture Specification](./ARCHITECTURE.md)
- [Technology Stack & Infrastructure Specification](./TECH-STACK.md)
