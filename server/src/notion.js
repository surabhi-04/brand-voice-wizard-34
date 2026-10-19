export class NotionApiError extends Error {
  constructor(message, status = 502, code = "NOTION_API_ERROR") {
    super(message);
    this.name = "NotionApiError";
    this.status = status;
    this.code = code;
  }
}

export class NotionAuthError extends NotionApiError {
  constructor(message = "Notion access has expired or was revoked. Please reconnect your workspace.") {
    super(message, 401, "NOTION_AUTH_EXPIRED");
    this.name = "NotionAuthError";
  }
}

export class NotionDestinationError extends NotionApiError {
  constructor(message = "Selected Notion destination is no longer accessible. Please choose an accessible page.") {
    super(message, 403, "NOTION_DESTINATION_INACCESSIBLE");
    this.name = "NotionDestinationError";
  }
}

const NOTION_API_VERSION = "2022-06-28";
const NOTION_API_BASE = "https://api.notion.com/v1";

/**
 * Builds the official Notion OAuth authorization URL.
 */
export function getNotionAuthorizationUrl({ clientId, redirectUri, state }) {
  if (!clientId) {
    throw new NotionApiError("NOTION_OAUTH_CLIENT_ID is not configured.", 503, "CONFIG_ERROR");
  }
  if (!redirectUri) {
    throw new NotionApiError("NOTION_OAUTH_REDIRECT_URI is not configured.", 503, "CONFIG_ERROR");
  }
  if (!state) {
    throw new NotionApiError("OAuth state parameter is required for CSRF protection.", 400);
  }

  const url = new URL("https://api.notion.com/v1/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("owner", "user");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  return url.toString();
}

/**
 * Exchanges a Notion OAuth authorization code for an access token and workspace metadata.
 */
export async function exchangeNotionOAuthCode({
  code,
  clientId,
  clientSecret,
  redirectUri,
  fetchImpl = fetch,
  mockResponse = null,
}) {
  if (mockResponse) {
    return mockResponse;
  }

  if (!clientId || !clientSecret) {
    throw new NotionApiError(
      "Notion OAuth Client ID and Secret must be configured to exchange authorization codes.",
      503,
      "CONFIG_ERROR",
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetchImpl(`${NOTION_API_BASE}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_API_VERSION,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new NotionApiError(`Notion returned invalid JSON during token exchange (${response.status})`);
  }

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `Token exchange failed with status ${response.status}`;
    throw new NotionApiError(`Notion OAuth failed: ${errorMsg}`, response.status);
  }

  return {
    accessToken: data.access_token,
    workspaceId: data.workspace_id,
    workspaceName: data.workspace_name || "Notion Workspace",
    workspaceIcon: data.workspace_icon || null,
    botId: data.bot_id || null,
    owner: data.owner || null,
  };
}

/**
 * Lists pages in the user's workspace that have been shared with this Notion integration.
 */
export async function listAccessibleDestinations({
  accessToken,
  fetchImpl = fetch,
  mockDestinations = null,
}) {
  if (mockDestinations) {
    return mockDestinations;
  }

  if (!accessToken) {
    throw new NotionAuthError();
  }

  const response = await fetchImpl(`${NOTION_API_BASE}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_API_VERSION,
    },
    body: JSON.stringify({
      filter: { value: "page", property: "object" },
      page_size: 25,
      sort: { direction: "descending", timestamp: "last_edited_time" },
    }),
  });

  if (response.status === 401) {
    throw new NotionAuthError();
  }

  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new NotionApiError("Failed to parse accessible Notion pages.");
  }

  if (!response.ok) {
    throw new NotionApiError(data?.message || "Failed to search Notion workspace", response.status);
  }

  const results = Array.isArray(data.results) ? data.results : [];
  return results.map((page) => {
    let title = "Untitled Page";
    const properties = page.properties || {};
    for (const key of Object.keys(properties)) {
      const prop = properties[key];
      if (prop.type === "title" && Array.isArray(prop.title) && prop.title.length > 0) {
        title = prop.title.map((t) => t.plain_text).join("").trim() || title;
        break;
      }
    }

    let icon = null;
    if (page.icon?.type === "emoji") {
      icon = page.icon.emoji;
    } else if (page.icon?.type === "external") {
      icon = page.icon.external?.url;
    }

    return {
      id: page.id,
      title,
      icon,
      url: page.url,
      lastEdited: page.last_edited_time,
    };
  });
}

/**
 * Creates a formatted campaign page in the user's Notion workspace.
 */
export async function createNotionCampaignPage({
  accessToken,
  brandName,
  objective,
  industry,
  audience,
  productInfo,
  brandVoiceProfile,
  tweets,
  destinationPageId = null,
  fetchImpl = fetch,
  mockResult = null,
}) {
  if (mockResult) {
    return mockResult;
  }

  if (!accessToken) {
    throw new NotionAuthError();
  }

  let parentPageId = destinationPageId;

  // If no parent page is pre-selected, find the first accessible page in the user's workspace
  if (!parentPageId) {
    const accessible = await listAccessibleDestinations({ accessToken, fetchImpl });
    if (!accessible || accessible.length === 0) {
      throw new NotionDestinationError(
        "No accessible Notion pages found. Please ensure you granted access to at least one page when authorizing Notion.",
      );
    }
    parentPageId = accessible[0].id;
  }

  const safeBrand = (brandName || "Brand").trim();
  const safeObjective = (objective || "Campaign").trim();
  const pageTitle = `${safeBrand} — ${safeObjective}`;

  // Assemble Notion block children
  const children = [];

  // Callout block for Brand Voice Profile summary
  const summary = (brandVoiceProfile?.summary || "").trim();
  const themes = Array.isArray(brandVoiceProfile?.themes) ? brandVoiceProfile.themes : [];
  const characteristics = Array.isArray(brandVoiceProfile?.characteristics)
    ? brandVoiceProfile.characteristics
    : [];

  children.push({
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: [{ type: "text", text: { content: "Brand Voice Profile" } }],
    },
  });

  const profileLines = [];
  if (summary) profileLines.push(`• Voice: ${summary}`);
  if (industry) profileLines.push(`• Industry: ${industry}`);
  if (audience) profileLines.push(`• Audience: ${audience}`);
  if (themes.length > 0) profileLines.push(`• Themes: ${themes.join(" · ")}`);
  if (characteristics.length > 0) profileLines.push(`• Style: ${characteristics.join(" · ")}`);
  if (productInfo) profileLines.push(`• Offer / Context: ${productInfo}`);

  for (const line of profileLines) {
    children.push({
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [{ type: "text", text: { content: line } }],
      },
    });
  }

  children.push({ object: "block", type: "divider", divider: {} });

  // Campaign Tweets section
  children.push({
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: [{ type: "text", text: { content: "Campaign Tweets (1–10)" } }],
    },
  });

  const tweetList = Array.isArray(tweets) ? tweets : [];
  tweetList.forEach((tweet, idx) => {
    const angle = tweet.angle || tweet.label || `Tweet ${idx + 1}`;
    const text = tweet.text || "";

    children.push({
      object: "block",
      type: "numbered_list_item",
      numbered_list_item: {
        rich_text: [
          {
            type: "text",
            text: { content: `[${angle}] ` },
            annotations: { bold: true },
          },
          {
            type: "text",
            text: { content: text },
          },
        ],
      },
    });
  });

  children.push({ object: "block", type: "divider", divider: {} });
  children.push({
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [
        {
          type: "text",
          text: {
            content: `Generated by Brand Voice AI on ${new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}`,
          },
          annotations: { italic: true, color: "gray" },
        },
      ],
    },
  });

  const payload = {
    parent: { page_id: parentPageId },
    icon: { type: "emoji", emoji: "📣" },
    properties: {
      title: {
        title: [{ type: "text", text: { content: pageTitle } }],
      },
    },
    children: children.slice(0, 95), // Notion API limits children per request to 100
  };

  const response = await fetchImpl(`${NOTION_API_BASE}/pages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_API_VERSION,
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    throw new NotionAuthError();
  }
  if (response.status === 404 || response.status === 403) {
    throw new NotionDestinationError(
      "The destination page is not accessible. Please choose an accessible Notion page.",
    );
  }

  const responseText = await response.text();
  let createdPage;
  try {
    createdPage = JSON.parse(responseText);
  } catch {
    throw new NotionApiError(`Notion returned non-JSON response (${response.status})`);
  }

  if (!response.ok) {
    throw new NotionApiError(
      createdPage?.message || `Failed to create Notion page (${response.status})`,
      response.status,
    );
  }

  return {
    id: createdPage.id,
    url: createdPage.url,
  };
}
