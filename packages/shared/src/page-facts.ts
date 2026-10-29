/**
 * What the worker found when it opened a start page once for "Mit KI beschreiben": the structure
 * the model needs to name elements exactly, and what the page shows on "Auf der Seite erkannt".
 */
export type PageFacts = {
  /** Address after redirects. */
  url: string;
  title: string;
  /** Accessibility tree of the page and its iframes (Playwright aria snapshots, YAML). */
  snapshot: string;
  forms: number;
  requiredFields: number;
  /** Consent tool found on the page, e.g. "Usercentrics"; null if none was recognised. */
  cookieBanner: string | null;
  /** GA4 measurement ids the page loaded or sent to. */
  ga4: string[];
};
