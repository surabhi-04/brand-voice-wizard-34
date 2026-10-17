# Brand Voice Wizard

Build a premium, visually distinctive, production-minded web application called **Brand Voice AI** — an AI-powered brand content studio that helps users understand a brand's written personality and generate 10 on-brand tweets for a campaign.



This is a serious hiring assignment. Prioritize excellent UI/UX, usability, coherent product thinking, clean component architecture, responsive design, and a polished experience. Do not build a generic AI SaaS template.



## 1. Product purpose



The user provides a brand name and optional campaign details. The product generates:



* A concise brand voice analysis.

* An inferred target audience.

* Relevant content themes and writing characteristics.

* Exactly 10 varied tweets suited to the brand and campaign.

* An interface to copy, regenerate, and eventually save campaigns to Notion.



The product must clearly distinguish inferred brand characteristics from facts supplied by the user. Do not claim to have analyzed live social media profiles unless that capability is genuinely implemented.



## 2. Art direction — make this feel original



Create a sophisticated editorial design system inspired by independent creative studios, modern publishing, and premium productivity products.



**Color palette**



* Warm porcelain background: #F7F5EF

* Deep forest green: #173D32

* Dark ink typography: #20231F

* Muted sage surfaces: #E7ECE4

* Restrained coral accent: #E77C63

* White cards: #FFFFFF

* Subtle warm-gray borders: #E5E1D8



Use forest green for important actions and dark surfaces, coral only for selective highlights, and porcelain as the main canvas. Maintain strong text contrast and accessible focus states. Avoid excessive color, gradients, neon, glassmorphism, and generic purple AI styling.



**Typography**

Use an elegant editorial serif for major display headings, paired with a clean, readable sans-serif for body text, form controls, navigation, and data. Use expressive scale, generous line-height, and careful letter spacing.



**Visual personality**



* Distinctive oversized typography and asymmetric editorial composition.

* Small uppercase section labels and thoughtful microcopy.

* Generous negative space, refined borders, subtle shadows, and consistent spacing.

* Carefully designed empty, loading, success, and error states.

* Restrained hover transitions and tasteful entrance animations.

* Small botanical or abstract editorial motifs only where they support the brand identity.

* Avoid unnecessary illustrations, excessive icons, clutter, and decorative elements that reduce usability.



The result should feel like a premium creative workspace, not a template dashboard.



## 3. Application structure



Create a polished, responsive single-page application with these areas:



### A. Navigation



A compact top navigation containing:



* Brand Voice AI wordmark with a small custom symbol.

* Links: Studio, How it works, Campaign library.

* A prominent “Create campaign” action.

* A mobile-friendly navigation menu.



Use smooth scrolling for in-page sections. Do not create fake login, subscription, or profile functionality.



### B. Hero section



Design a memorable, editorial hero with a clear headline:



“Find the voice. Make it matter.”



Supporting copy:

“Turn what makes a brand distinctive into 10 ideas worth posting.”



Include:



* A small “AI BRAND CONTENT STUDIO” eyebrow label.

* A primary “Create your campaign” CTA that scrolls to the campaign form.

* A secondary “See how it works” link.

* An attractive, custom-designed preview composition showing snippets of sample content, a compact brand voice profile, and the number “10” as a strong visual element.

* An understated visual motif based on speech marks, editorial annotations, or overlapping paper-like cards.



The preview should demonstrate the product concept without overwhelming the hero. Use CSS and existing icon components rather than depending on external image assets.



### C. Campaign creation studio — the main feature



This should be the most carefully designed and usable part of the website.



Create a spacious two-column desktop layout:



* Left: campaign configuration form.

* Right: a helpful live preview or contextual guidance panel.

* Stack the columns naturally on mobile.



Form fields:



1. Brand name — required text input.

2. Industry/category — optional input.

3. Campaign objective — select with options such as Brand awareness, Product launch, Engagement, Community building, Education, and Traffic.

4. Product/service details — optional multiline textarea.

5. Target audience — optional input.

6. Preferred tone — selectable chips such as Witty, Friendly, Bold, Professional, Playful, Informative, and Empathetic. Allow multiple selections.

7. Additional instructions — optional textarea for constraints or campaign context.



Include helpful placeholders, labels, brief descriptions, and clear required-field validation. Do not rely on placeholders as labels.



Add a prominent action button:

“Generate 10 tweets”



While generating, show an elegant loading state with rotating or sequential status messages. Prevent duplicate submissions while a request is running. Show useful, actionable errors if generation fails.



Do not generate results automatically when the page loads.



### D. Brand voice results



Design a high-quality results workspace that appears after a successful generation.



At the top, display:



* Brand name.

* Campaign objective.

* A concise brand voice summary.

* Target audience.

* Content themes.

* Writing style characteristics.



Use an editorial profile card with compact tags and a clean information hierarchy. Clearly label inferred attributes where appropriate.



Below it, display exactly 10 numbered tweet cards.



Each card should include:



* Tweet number.

* A content-style label, such as Conversational, Promotional, Educational, Witty, Community-focused, or Storytelling.

* The tweet text.

* A character count.

* A copy button with clear copied-state feedback.

* A regenerate action for that individual tweet.



Give the cards subtle visual variation while maintaining a coherent system. Make the tweet text easy to scan and copy.



Above the list, include:



* “Copy all tweets”.

* “Regenerate all” with confirmation or appropriate loading behavior.

* “Save campaign to Notion”.



Do not claim that an operation succeeded unless it actually succeeded. Regenerating one tweet should not unnecessarily erase the other nine.



If the real AI integration has not yet been connected, show a clear integration-pending state rather than fabricated live results. Do not present static sample tweets as real AI-generated results.



### E. How it works



Create a concise three-step section:



1. Tell us about your brand.

2. Discover your voice.

3. Create 10 campaign-ready tweets.



Use a clean numbered editorial layout with subtle separators and small custom icons. Explain the workflow in plain language without making unsupported AI claims.



### F. Campaign library



Create a well-designed campaign history section intended to display campaigns actually saved through the Notion integration.



Include:



* Campaign name and brand.

* Objective.

* Creation date when available.

* A view/open action when campaign data exists.

* A thoughtful empty state explaining that saved campaigns will appear here after the Notion integration is connected.



Do not invent previously saved campaigns. Do not imply that browser-local demo data is persistent cloud storage.



### G. Footer



A minimal footer with the Brand Voice AI wordmark, a short product description, and links to the Studio and How it works sections.



## 4. Interaction and usability requirements



Implement the following frontend behaviors:



* Smooth anchor navigation.

* Responsive mobile navigation.

* Controlled form inputs.

* Required-field validation for brand name.

* Multi-select tone chips with clear selected states.

* Loading and error states.

* Individual tweet copy and copy-all behavior.

* Individual tweet regeneration and regenerate-all controls.

* Character counts for tweets.

* Save-to-Notion action with genuine success and failure feedback once integrated.

* Keyboard-accessible controls, visible focus indicators, and accessible labels.

* Respect reduced-motion preferences.

* Useful empty states and confirmation for potentially destructive actions.



Use a consistent icon library such as Lucide if supported. Avoid emoji as the primary icon system.



## 5. Technical implementation



Use React, Vite, TypeScript if supported by the current project, and Tailwind CSS or the project's existing styling system. Use reusable, well-organized components and a small, consistent design-token system.



Suggested components:



* Navbar

* Hero

* CampaignForm

* ToneSelector

* GenerationStatus

* BrandVoiceSummary

* TweetCard

* TweetResults

* HowItWorks

* CampaignLibrary

* Footer



Keep the UI separated from AI and automation integrations. Use clearly defined service functions for generation, tweet regeneration, and Notion saving so the actual backend can be connected without rewriting the interface.



Do not expose API keys or secrets in frontend code. Do not put private tokens into Vite environment variables prefixed with VITE_.



If a backend already exists, inspect and preserve it. Do not overwrite existing working functionality unnecessarily.



Do not create a fake AI implementation, fake Notion integration, or fake success responses. If integration endpoints are not available yet, implement explicit pending states and document the required API contracts.



Do not add authentication, billing, e-commerce, direct social posting, or unnecessary features.



## 6. Quality requirements



* Every visible button must perform its intended action or be clearly marked as pending integration.

* Avoid dead links and decorative controls that appear functional but are not.

* Ensure the layout works on mobile, tablet, and desktop.

* Keep the form fast and intuitive.

* Use consistent spacing, typography, border radii, and interaction states.

* Avoid excessive animations and unnecessary dependencies.

* Include accessible contrast and keyboard navigation.

* Do not use stock dashboard layouts or generic gradient-heavy AI visuals.



## 7. Completion requirements



First inspect the current project and its framework. Then implement the interface as a coherent, working application rather than returning only a design proposal.



After implementation:



1. Run the available build and type checks.

2. Fix compilation errors and broken interactions.

3. Verify the main layout at mobile and desktop sizes.

4. Check that form validation and copy interactions work.

5. Identify which features are fully functional and which require backend integration.

6. Provide a concise summary of changed files, commands to run the project, and the API contracts needed for the Gemini backend and n8n/Notion workflow.



Focus on an exceptionally polished, distinctive, accessible interface that remains straightforward to use and practical to integrate with a real backend.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/78751819-1a72-46ad-b8c4-f5e1affa7e36).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
