// Phonetic Arabic → Latin map — Jhome logins are checked against a
// courses_credentials document whose ID *is* the username, and that ID
// must be ASCII (used to build synthetic emails / Firebase Auth uids).
const ARABIC_TO_LATIN_MAP = {
    'ا': 'a', 'أ': 'a', 'إ': 'a', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
    'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'th', 'ر': 'r', 'ز': 'z',
    'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
    'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ة': 'a', 'ئ': 'y', 'ؤ': 'w', 'ء': 'a'
};

function transliterateToUsername(rawName) {
    const firstWord = String(rawName || '').trim().split(/\s+/)[0] || '';
    const transliterated = firstWord.split('').map(ch => ARABIC_TO_LATIN_MAP[ch] ?? ch).join('');
    return transliterated.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export class JhomeRepository {
    // Lazy getter: firebase may not be ready at module parse time
    get db() { return window.firebase.app('jhome').firestore(); }

    // Generates a unique, login-safe username and creates the
    // courses_credentials document with that username as its doc ID —
    // required because api_v1_academy_login looks credentials up by
    // `doc(username).get()`, not by a `username` field query.
    async _createCredentialDoc(baseName, fallbackPrefix, extraData) {
        const base = transliterateToUsername(baseName) || fallbackPrefix;
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let password = "";
        for (let i = 0; i < 8; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        let username;
        let credRef;
        let attempts = 0;
        do {
            const randNum = Math.floor(1000 + Math.random() * 9000);
            username = base + randNum;
            credRef = this.db.collection('courses_credentials').doc(username);
            attempts++;
        } while (attempts < 5 && (await credRef.get()).exists);

        await credRef.set({
            ...extraData,
            username,
            password,
            createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });

        return { ref: credRef, username, password };
    }

    async getProjects() {
        const snap = await this.db.collection('projects').orderBy('createdAt', 'desc').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async addProject(projectData) {
        return await this.db.collection('projects').add({
            ...projectData,
            createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async deleteProject(id) {
        return await this.db.collection('projects').doc(id).delete();
    }

    // ── Stories ──
    async getPublishedStories() {
        const snap = await this.db.collection('successStories').where('isPublished', '==', true).get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async getPendingSubmissions() {
        const snap = await this.db.collection('storySubmissions').where('status', '==', 'pending').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async approveStorySubmission(id) {
        return await this.db.collection('storySubmissions').doc(id).update({ status: 'approved' });
    }

    async rejectStorySubmission(id) {
        return await this.db.collection('storySubmissions').doc(id).update({ status: 'rejected' });
    }

    async deleteStory(id) {
        return await this.db.collection('successStories').doc(id).delete();
    }

    async addStory(storyData) {
        return await this.db.collection('successStories').add({
            ...storyData,
            isPublished: true,
            createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    // ── Blog / Posts ──
    async getPosts() {
        const snap = await this.db.collection('posts').orderBy('publishedAt', 'desc').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async deletePost(id) {
        return await this.db.collection('posts').doc(id).delete();
    }

    async addPost(postData) {
        return await this.db.collection('posts').add({
            ...postData,
            status: 'published',
            views: 0,
            publishedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async getCourses() {
        const snap = await this.db.collection('courses').get();
        let courses = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        courses.sort((a, b) => {
            const timeA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
            const timeB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
            return timeB - timeA;
        });
        return courses;
    }

    async addCourse(courseData) {
        return await this.db.collection('courses').add({
            ...courseData,
            createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async deleteCourse(id) {
        // Delete related enrollment requests
        const reqsSnap = await this.db.collection('enrollmentRequests').where('courseId', '==', id).get();
        const batch = this.db.batch();
        reqsSnap.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Delete related course credentials
        const credsSnap = await this.db.collection('courses_credentials').where('courseId', '==', id).get();
        credsSnap.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Commit batch deletions
        await batch.commit();

        // Finally delete the course itself
        return await this.db.collection('courses').doc(id).delete();
    }

    async getCourseRequests(courseId) {
        if (!courseId) return [];
        const snap = await this.db.collection('enrollmentRequests').where('courseId', '==', courseId).get();
        let requests = snap.docs.map(doc => {
            const data = doc.data();
            const studentObj = data.student || {};
            return { 
                id: doc.id, 
                ...data,
                fullName: data.fullName || studentObj.fullName || data.name || '—',
                phone: data.phone || studentObj.phone || '—',
                requestNumber: data.requestNumber || studentObj.requestNumber || '—',
                receiptUrl: data.receiptUrl || studentObj.receiptUrl || null
            };
        });
        requests.sort((a, b) => {
            const timeA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
            const timeB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
            return timeB - timeA;
        });
        return requests;
    }

    async approveCourseRequest(reqId) {
        const jhomeAuth = this.db.app.auth();
        if (!jhomeAuth.currentUser) {
            throw new Error("حسابك غير مسجل في نظام Jhome (Authentication). يرجى التأكد من أن البريد وكلمة المرور متطابقان في كلا المشروعين.");
        }

        const reqRef = this.db.collection('enrollmentRequests').doc(reqId);
        const reqDoc = await reqRef.get();
        if (!reqDoc.exists) throw new Error("Request not found");
        const rawData = reqDoc.data();
        const reqData = {
            ...rawData,
            fullName: rawData.fullName || (rawData.student && rawData.student.fullName) || rawData.name || 'غير محدد',
            phone: rawData.phone || (rawData.student && rawData.student.phone) || '',
            email: rawData.email || ''
        };

        if (reqData.status === 'approved') {
            throw new Error("الطلب مقبول مسبقاً (Request is already approved)");
        }

        let username, password, credRef;
        try {
            const created = await this._createCredentialDoc(reqData.fullName, 'student', {
                courseId: reqData.courseId,
                studentId: reqData.email || reqData.phone || '',
                requestId: reqId,
                role: 'student',
                active: true,
                loginCount: 0,
                mustChangePassword: true,
                createdBy: jhomeAuth.currentUser.uid
            });
            credRef = created.ref;
            username = created.username;
            password = created.password;
        } catch (e) {
            console.error("Error writing to courses_credentials:", e);
            if (e.code === 'permission-denied') {
                throw new Error("ليس لديك صلاحية الكتابة في جدول courses_credentials. يرجى تعديل Firebase Rules في مشروع Jhome.");
            }
            throw e;
        }

        try {
            await reqRef.update({ 
                status: 'approved',
                reviewedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
                reviewedBy: jhomeAuth.currentUser.uid,
                credentialId: credRef.id
            });
        } catch (e) {
            console.error("Error updating enrollmentRequests:", e);
            if (e.code === 'permission-denied') {
                throw new Error("ليس لديك صلاحية التعديل على جدول enrollmentRequests. يرجى تعديل Firebase Rules في مشروع Jhome.");
            }
            throw e;
        }

        return {
            username,
            password,
            phone: reqData.phone,
            email: reqData.email,
            name: reqData.fullName
        };
    }

    async rejectCourseRequest(reqId) {
        return await this.db.collection('enrollmentRequests').doc(reqId).update({ 
            status: 'rejected',
            reviewedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
            reviewedBy: 'admin'
        });
    }

    async getCourseUsers(courseId) {
        if (!courseId) return [];
        const snap = await this.db.collection('courses_credentials').where('courseId', '==', courseId).get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async addCourseInstructor(data) {
        const jhomeAuth = this.db.app.auth();
        if (!jhomeAuth.currentUser) {
            throw new Error("حسابك غير مسجل في نظام Jhome (Authentication). يرجى التأكد من أن البريد وكلمة المرور متطابقان في كلا المشروعين.");
        }
        try {
            const { courseId, name } = data;
            const created = await this._createCredentialDoc(name, 'admin', {
                courseId,
                name,
                role: 'admin',
                active: true,
                createdBy: jhomeAuth.currentUser.uid
            });
            return { username: created.username, password: created.password, name };
        } catch (e) {
            if (e.code === 'permission-denied') {
                throw new Error("ليس لديك صلاحية الكتابة في جدول courses_credentials. يرجى تعديل Firebase Rules في مشروع Jhome.");
            }
            throw e;
        }
    }

    async deleteCourseUser(userId) {
        return await this.db.collection('courses_credentials').doc(userId).delete();
    }

    // --- Curriculum Database Operations ---
    
    async getCurriculumSections(courseId) {
        const snap = await this.db.collection('curriculum_sections')
            .where('courseId', '==', courseId)
            .orderBy('createdAt', 'asc')
            .get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async addCurriculumSection(courseId, title) {
        return await this.db.collection('curriculum_sections').add({
            courseId,
            title,
            createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    async deleteCurriculumSection(sectionId) {
        const batch = this.db.batch();
        
        // Delete lessons inside the section
        const lessonsSnap = await this.db.collection('curriculum_lessons')
            .where('sectionId', '==', sectionId)
            .get();
        lessonsSnap.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Delete the section itself
        batch.delete(this.db.collection('curriculum_sections').doc(sectionId));
        return await batch.commit();
    }

    async getCurriculumLessons(sectionId) {
        const snap = await this.db.collection('curriculum_lessons')
            .where('sectionId', '==', sectionId)
            .orderBy('createdAt', 'asc')
            .get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async addCurriculumLesson(sectionId, courseId, lessonData) {
        return await this.db.collection('curriculum_lessons').add({
            sectionId,
            courseId,
            ...lessonData,
            createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
    }
}

export const jhomeRepository = new JhomeRepository();
