/**
 * Add this inside your Squarespace language switcher script,
 * in the select "change" handler — BEFORE window.location.href = ...
 *
 * Requires self-hosted API with DATABASE_URL and data-api-base pointing at your server.
 */
function eaglesTrackLanguageSwitch(langCode, suffix, apiBase) {
  var base = (apiBase || "").replace(/\/+$/, "");
  if (!base) return;
  fetch(base + "/api/event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      eventType: "language_switch",
      locale: langCode,
      pagePath: window.location.pathname,
      metadata: { suffix: suffix || "", to: langCode },
    }),
    keepalive: true,
  }).catch(function () {});
}

// Example inside your existing change handler:
// select.addEventListener('change', function () {
//   if (this.value === currentSuffix) return;
//   var langCode = languages[this.value] ? languages[this.value].code : 'en';
//   eaglesTrackLanguageSwitch(langCode, this.value, 'https://api.your-server.com');
//   localStorage.setItem('lang', this.value);
//   window.location.href = getTargetUrl(this.value, window.location);
// });
