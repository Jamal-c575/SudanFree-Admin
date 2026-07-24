export class JhomeRepository {
    constructor() {
        // Access the globally initialized secondary Firebase app
        this.db = window.firebase.app('jhome').firestore();
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
        let requests = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        requests.sort((a, b) => {
            const timeA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
            const timeB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
            return timeB - timeA;
        });
        return requests;
    }

    async approveCourseRequest(reqId) {
        const reqRef = this.db.collection('enrollmentRequests').doc(reqId);
        const reqDoc = await reqRef.get();
        if (!reqDoc.exists) throw new Error("Request not found");
        const reqData = reqDoc.data();

        if (reqData.status === 'approved') {
            throw new Error("Request is already approved");
        }

        const randNum = Math.floor(1000 + Math.random() * 9000);
        let username = reqData.fullName 
            ? reqData.fullName.split(' ')[0].toLowerCase() + randNum 
            : 'student' + randNum;
        
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let password = "";
        for (let i = 0; i < 8; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const credRef = await this.db.collection('courses_credentials').add({
            courseId: reqData.courseId,
            studentId: reqData.email || reqData.phone || '',
            requestId: reqId,
            username: username,
            password: password, // TODO: Replace plaintext passwords with hashed passwords before public launch.
            role: 'student',
            active: true,
            loginCount: 0,
            mustChangePassword: true,
            createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: 'admin'
        });

        return await reqRef.update({ 
            status: 'approved',
            reviewedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
            reviewedBy: 'admin',
            credentialId: credRef.id
        });
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
        return await this.db.collection('courses_credentials').add({
            ...data,
            createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
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
