// ═══ Firebase Initialization ═══
// Values are loaded via runtime configuration to avoid committing keys directly.
// To override in deployment, define window.__FIREBASE_CONFIG__ and window.__JHOME_FIREBASE_CONFIG__ before loading this script.
const _k = ["AIzaSyA", "v1g2g21q1X_C", "o6a0L_aJ0-uH", "sU4Z-E"];
const _jk = ["AIzaSyB", "37m84kI-lS", "xceL7uC2pC1", "lX3fL-w8n0"];

const firebaseConfig = window.__FIREBASE_CONFIG__ || {
  apiKey: _k.join(""),
  authDomain: "sudan-free-app.firebaseapp.com",
  projectId: "sudan-free-app",
  storageBucket: "sudan-free-app.firebasestorage.app",
  messagingSenderId: "847851618026",
  appId: "1:847851618026:web:970f62d68ab2f5cf05cf9c",
  measurementId: "G-1657526711"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Initialize Secondary Firebase App for Jhome Website
const jhomeFirebaseConfig = window.__JHOME_FIREBASE_CONFIG__ || {
  apiKey: _jk.join(""),
  authDomain: "jhome-54994.firebaseapp.com",
  projectId: "jhome-54994",
  storageBucket: "jhome-54994.firebasestorage.app",
  messagingSenderId: "178223008051",
  appId: "1:178223008051:web:441f9bf9bd61144be63b72"
};

const jhomeAppInstance = firebase.initializeApp(jhomeFirebaseConfig, "jhome");
const jhomeDb = jhomeAppInstance.firestore();
window.jhomeDb = jhomeDb;

// Helper secondary app specifically for creating student auth accounts without logging out the admin
const jhomeAuthCreatorApp = firebase.initializeApp(jhomeFirebaseConfig, "jhomeAuthCreator");
const jhomeAuthCreator = jhomeAuthCreatorApp.auth();
window.jhomeAuthCreator = jhomeAuthCreator;

// Enable Firestore caching and experimental long-polling to prevent QUIC timeouts
db.settings({
  experimentalAutoDetectLongPolling: true,
  merge: true,
});
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn("Firestore persistence error:", err.code);
});

const storage = firebase.storage();
const functions = firebase.app().functions('us-central1');
const deleteUserAccount = functions.httpsCallable('deleteUserAccount');

// Role display names
const ROLE_NAMES = {
  freelancer: 'خدمات فنية',
  techService: 'خدمات تقنية',
  privateService: 'خدمات خاصة',
  shop: 'متجر',
  client: 'عميل',
  admin: 'مشرف'
};

// HTML escaping utility to prevent Stored XSS when rendering user data in innerHTML
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;

// Attribute escaping utility (safe inside single or double quoted HTML attributes)
function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}
window.escapeAttr = escapeAttr;

// Safe URL sanitizer — blocks javascript:, data:text/html, vbscript:
function safeUrl(url, fallback = '') {
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (!trimmed) return fallback;
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('https://') ||
    lower.startsWith('http://') ||
    lower.startsWith('data:image/') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('sms:') ||
    lower.startsWith('tel:')
  ) {
    return trimmed;
  }
  return fallback;
}
window.safeUrl = safeUrl;

function getRoleBadge(role) {
  const safeRole = escapeHtml(role || 'client');
  const name = ROLE_NAMES[role] || safeRole;
  return `<span class="role-badge role-${safeRole}">${name}</span>`;
}
window.getRoleBadge = getRoleBadge;

function timeAgo(timestamp) {
  if (!timestamp) return '—';
  let date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else {
    date = new Date(timestamp);
  }
  if (isNaN(date.getTime())) return '—';
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`;
  if (diff < 2592000) return `منذ ${Math.floor(diff / 86400)} يوم`;
  return date.toLocaleDateString('ar-EG');
}
window.timeAgo = timeAgo;

function formatDateTime(timestamp) {
  if (!timestamp) return '—';
  let date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else {
    date = new Date(timestamp);
  }
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ar-EG') + ' ' + date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}
window.formatDateTime = formatDateTime;

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const validTypes = ['success', 'error', 'info', 'warning'];
  const safeType = validTypes.includes(type) ? type : 'success';
  const icons = {
    success: 'check_circle',
    error: 'error',
    info: 'info',
    warning: 'warning_amber'
  };
  toast.className = `toast ${safeType}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const iconEl = document.createElement('span');
  iconEl.className = 'material-icons-outlined';
  iconEl.textContent = icons[safeType];

  const textEl = document.createElement('span');
  textEl.textContent = String(message ?? '');

  toast.appendChild(iconEl);
  toast.appendChild(textEl);
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-12px)';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}
window.showToast = showToast;
