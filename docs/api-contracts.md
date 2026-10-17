# Brand Voice AI API contracts

The Vite app is a static frontend. Configure the public Express API origin as `VITE_API_BASE_URL` when the backend is ready. When it is empty, campaign actions stay in an explicit pending state. The frontend does not contain Gemini, Notion, n8n, or webhook credentials.

## Backend deployment

Deploy the Node.js + Express API as a separate Node-capable service (for example, Render, Railway, or Fly.io). Keep Gemini API keys, Notion credentials, and n8n webhook configuration in that service's private environment. Allow CORS only from the deployed Vercel frontend origin. Configure the frontend's `VITE_API_BASE_URL` to the deployed API origin and rebuild the static site after changing it. Vercel builds and serves only the frontend (`npm run build` → `dist`).

## Endpoints

All request bodies must be validated server-side with Zod. Return JSON and actionable non-2xx errors; never log API keys or full private credentials.

### `POST /api/campaigns/generate`

Request JSON:

```json
{
  "brandName": "Fieldwork",
  "industry": "Independent design",
  "objective": "Brand awareness",
  "details": "Thoughtful tools for everyday work.",
  "audience": "Independent creatives",
  "tones": ["Friendly", "Witty"],
  "instructions": "Avoid hype."
}
```

Response JSON:

```json
{
  "campaignId": "campaign-opaque-id",
  "profile": {
    "summary": "A concise voice analysis.",
    "audience": "An inferred audience description.",
    "themes": ["Craft", "Everyday rituals"],
    "characteristics": ["Conversational", "Specific"],
    "inferredFields": ["summary", "audience", "themes", "characteristics"]
  },
  "tweets": [
    { "id": "opaque-tweet-id-1", "label": "Conversational", "text": "A generated tweet." }
  ]
}
```

Return exactly ten tweets. `inferredFields` identifies which profile attributes are inferred; do not claim live profile analysis unless implemented. Text or facts the user supplied should not be mislabeled as inferred.

### `POST /api/campaigns/:campaignId/tweets/:tweetNumber/regenerate`

The request includes the validated campaign brief and `tweetNumber` (1–10). Return one `{ "id", "label", "text" }` tweet. The frontend changes only that card after a valid response.

### `POST /api/campaigns/:campaignId/regenerate`

The request includes the validated campaign brief. Return `{ "tweets": [...] }` with exactly ten valid tweets. The frontend asks for confirmation and preserves the current set if the request fails.

### `POST /api/campaigns/:campaignId/notion-save`

The request body contains the validated campaign result. Save through a real n8n/Notion integration, then return `{ "saved": true, "url": "https://..." }` (the URL is optional). Return success only after the save actually completes.

### `GET /api/campaigns/history`

Return an array of actually saved campaigns: `[{ "id", "brandName", "objective", "createdAt", "url" }]`. Return `[]` for an empty library; never seed sample campaigns.