export class AdminDataRepository {
    constructor() {
        this.db = window.firebase.app('jhome').firestore();
    }

    // ── Messages ──
    async getMessages() {
        const snap = await this.db.collection('messages').orderBy('createdAt', 'desc').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async markMessageRead(id) {
        return await this.db.collection('messages').doc(id).update({ status: 'read' });
    }

    // ── Newsletter ──
    async getNewsletterSubscribers() {
        const snap = await this.db.collection('newsletter').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // ── System Users ──
    async getUsers() {
        const snap = await this.db.collection('users').orderBy('createdAt', 'desc').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async saveUser(userData) {
        return await this.db.collection('users').add({
            ...userData,
            createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async deleteUser(id) {
        return await this.db.collection('users').doc(id).delete();
    }

    // ── Bank Accounts ──
    async getBankAccounts() {
        const snap = await this.db.collection('bank_accounts').orderBy('createdAt', 'desc').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async saveBankAccount(accountData) {
        return await this.db.collection('bank_accounts').add({
            ...accountData,
            createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async deleteBankAccount(id) {
        return await this.db.collection('bank_accounts').doc(id).delete();
    }
}

export const adminDataRepository = new AdminDataRepository();
