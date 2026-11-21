/**
 * PrivateUserHelper — Merges public `users/{uid}` and private `users/{uid}/private/main`
 * documents for admin inspection, and performs dual-write ban updates.
 */
(function () {
  const _cache = new Map();
  const CACHE_TTL_MS = 45000;

  const PrivateUserHelper = {
    invalidate(uid) {
      if (uid) {
        _cache.delete(uid);
      } else {
        _cache.clear();
      }
    },

    /**
     * Fetches and merges `users/{uid}` + `users/{uid}/private/main`.
     * @param {string} uid
     * @param {Object|null} baseUserData Optional already-loaded public user document
     * @returns {Promise<Object|null>}
     */
    async fetchUserWithPrivate(uid, baseUserData = null) {
      if (!uid) return baseUserData || null;

      const cached = _cache.get(uid);
      if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
        return baseUserData ? { ...baseUserData, ...cached.data, id: uid } : cached.data;
      }

      try {
        const pubPromise = baseUserData
          ? Promise.resolve({ exists: true, data: () => baseUserData })
          : db.collection('users').doc(uid).get();

        const privPromise = db
          .collection('users')
          .doc(uid)
          .collection('private')
          .doc('main')
          .get()
          .catch(() => ({ exists: false, data: () => ({}) }));

        const [pubSnap, privSnap] = await Promise.all([pubPromise, privPromise]);
        if (!pubSnap.exists && !privSnap.exists && !baseUserData) {
          return null;
        }

        const pubData = (pubSnap && pubSnap.exists) ? (pubSnap.data() || {}) : (baseUserData || {});
        const privData = (privSnap && privSnap.exists) ? (privSnap.data() || {}) : {};

        const merged = {
          ...pubData,
          ...privData,
          id: uid,
          email: privData.email || pubData.email || '',
          phoneNumber: privData.phoneNumber || pubData.phoneNumber || '',
          whatsappNumber: privData.whatsappNumber || pubData.whatsappNumber || '',
          idCardUrl: privData.idCardUrl || pubData.idCardUrl || '',
          verificationSelfieUrl: privData.verificationSelfieUrl || pubData.verificationSelfieUrl || '',
          bankAccounts: Array.isArray(privData.bankAccounts)
            ? privData.bankAccounts
            : (Array.isArray(pubData.bankAccounts) ? pubData.bankAccounts : []),
          walletBalance: typeof privData.walletBalance === 'number'
            ? privData.walletBalance
            : (typeof pubData.walletBalance === 'number' ? pubData.walletBalance : 0),
          isBanned: Boolean(privData.isBanned || pubData.isBanned),
          banReason: privData.banReason || pubData.banReason || null
        };

        _cache.set(uid, { ts: Date.now(), data: merged });
        return merged;
      } catch (err) {
        console.warn('PrivateUserHelper.fetchUserWithPrivate error:', err);
        return baseUserData ? { id: uid, ...baseUserData } : null;
      }
    },

    /**
     * Dual-writes ban status to both `users/{uid}` and `users/{uid}/private/main`.
     */
    async updateBanDual(uid, { isBanned, banReason = null, bannedBy = null }) {
      if (!uid) throw new Error('معرف المستخدم مفقود');
      const now = firebase.firestore.FieldValue.serverTimestamp();
      const payload = isBanned
        ? {
            isBanned: true,
            banReason: banReason || 'مخالفة شروط الاستخدام',
            bannedAt: now,
            bannedBy: bannedBy || (auth.currentUser ? auth.currentUser.uid : null),
            updatedAt: now
          }
        : {
            isBanned: false,
            banReason: null,
            bannedAt: null,
            bannedBy: null,
            updatedAt: now
          };

      const batch = db.batch();
      const pubRef = db.collection('users').doc(uid);
      const privRef = pubRef.collection('private').doc('main');

      batch.set(pubRef, payload, { merge: true });
      batch.set(privRef, payload, { merge: true });
      await batch.commit();
      this.invalidate(uid);
    }
  };

  window.PrivateUserHelper = PrivateUserHelper;
})();
