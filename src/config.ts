/** Production AltUten API (Azure App Service). */
const PRODUCTION_API_URL =
  'https://utengluten-cvg7h6fqgxhxd9cw.swedencentral-01.azurewebsites.net';

/**
 * App runtime configuration.
 * Always uses the live AltUten API — never localhost or a LAN test server.
 */
export const config = {
  /**
   * Base URL of the .NET backend API.
   */
  apiBaseUrl: PRODUCTION_API_URL,

  /**
   * Web registration page (opened in the system browser from the app).
   */
  get registerUrl() {
    return `${this.apiBaseUrl.replace(/\/+$/, '')}/register`;
  },

  /** Public AltUten website (account pages, billing). */
  websiteBaseUrl: 'https://altuten.no',

  /**
   * "Min side" on the website, where members manage or cancel their
   * subscription. The app hands its session over in the URL fragment.
   */
  minSideUrl(sessionToken?: string | null) {
    const base = `${this.websiteBaseUrl.replace(/\/+$/, '')}/min-side`;
    const token = sessionToken?.trim();
    // Fragment (not query) so the token never reaches the server or its logs.
    return token ? `${base}#token=${encodeURIComponent(token)}` : base;
  },

  /**
   * Always talk to the live backend (MSSQL via .NET).
   */
  useBackend: true as const,
};
