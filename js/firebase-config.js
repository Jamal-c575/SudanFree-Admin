// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyD8y9NJNVycJLQZ0bVyRViygAIJ8uTcNIo",
  authDomain: "sudanfree-d04fc.firebaseapp.com",
  projectId: "sudanfree-d04fc",
  storageBucket: "sudanfree-d04fc.firebasestorage.app",
  messagingSenderId: "233114260",
  appId: "1:233114260:web:de4ee3967ea04073620281",
  measurementId: "G-XXXXXXXXXX" // Optional, replace when available
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
const functions = firebase.functions();
const deleteUserAccount = functions.httpsCallable('deleteUserAccount');

// Role names mapping
const ROLE_NAMES = {
  freelancer: 'خدمات فنية',
  techService: 'خدمات تقنية',
  privateService: 'خدمات خاصة',
  shop: 'متجر',
  client: 'عميل',
  admin: 'مشرف'
};

// Helper functions
function getRoleBadge(role) {
  return `<span class="role-badge role-${role}">${ROLE_NAMES[role] || role}</span>`;
}

function timeAgo(date) {
  if (!date) return '';
  const d = date.toDate ? date.toDate() : new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff/60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff/3600)} ساعة`;
  return `منذ ${Math.floor(diff/86400)} يوم`;
}

function showToast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="material-icons-outlined">${type === 'success' ? 'check_circle' : 'error'}</span>${msg}`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}
