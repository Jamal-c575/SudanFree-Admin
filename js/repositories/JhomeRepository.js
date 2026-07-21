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
        return await this.db.collection('courses').doc(id).delete();
    }

    async getCourseRequests() {
        const snap = await this.db.collection('enrollmentRequests').orderBy('createdAt', 'desc').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async approveCourseRequest(reqId) {
        return await this.db.collection('course_requests').doc(reqId).update({ status: 'approved' });
    }

    async rejectCourseRequest(reqId) {
        return await this.db.collection('course_requests').doc(reqId).update({ status: 'rejected' });
    }

    async getCourseUsers() {
        const snap = await this.db.collection('courses_credentials').get();
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
}

export const jhomeRepository = new JhomeRepository();
