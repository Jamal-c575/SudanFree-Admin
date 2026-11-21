/**
 * extras.js — Ensures window.AdminExtras is exposed for backward compatibility.
 * Core logic is provided by ModerationModule (js/modules/moderation.js).
 */
if (!window.AdminExtras && window.ModerationModule) {
  window.AdminExtras = window.ModerationModule;
}
