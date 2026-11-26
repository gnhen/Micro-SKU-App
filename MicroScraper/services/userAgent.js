// User agent for the Android challenge WebView.
//
// The stock Android WebView UA contains "; wv)" and "Version/4.0" tokens that
// mark it as an embedded WebView rather than Chrome. iOS already overrides its
// WebView UA to look like Safari (see applicationNameForUserAgent in the
// WebView components), and scraper.ts sends a Chrome UA for native requests.
// This gives Android the same treatment, using Chrome's "reduced" UA format.
//
// Keep the Chrome major version reasonably close to the installed Android
// System WebView, and bump it every few months. The solved WebView reports this
// string via navigator.userAgent, which setScraperUserAgent() then reuses for
// native requests, so the whole session stays consistent.
export const ANDROID_WEBVIEW_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
