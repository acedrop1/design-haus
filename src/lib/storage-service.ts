import { Message, DesignSession, Attachment } from "@/types";
import { db, storage } from "@/lib/firebase";
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    doc,
    updateDoc,
    getDoc,
    getDocs
} from "firebase/firestore";

// --- Mock Data Structure for LocalStorage ---
// Key: "designhaus_db"
// Value: { sessions: { [id]: DesignSession }, messages: { [sessionId]: { [msgId]: Message } } }

const LOCAL_STORAGE_KEY = "designhaus_db";

function getLocalDB() {
    if (typeof window === 'undefined') return { sessions: {}, messages: {} };
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : { sessions: {}, messages: {} };
}

function saveLocalDB(data: unknown) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    // Dispatch event for other tabs/components to react
    window.dispatchEvent(new Event('storage-update'));
}

// Helper to determine if we should use Firebase or Mock
// We check if the API key is present and not the mock default string.
const isRealEnv = process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    !process.env.NEXT_PUBLIC_FIREBASE_API_KEY.startsWith("mock_");

const USE_MOCK = !isRealEnv; // If not real env, use mock.

// Log mode on initialization
if (typeof window !== 'undefined') {
    console.log("🚨 [STORAGE] Mode:", USE_MOCK ? "MOCK (LocalStorage)" : "FIREBASE (Real-time)");
    console.log("🚨 [STORAGE] Firebase API Key:", process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "SET" : "NOT SET");
}

// Fallback State
let USE_FALLBACK = false;

export const StorageService = {

    // --- Sessions ---

    async verifySession(sessionId: string): Promise<boolean> {
        if (USE_MOCK || USE_FALLBACK) {
            const db = getLocalDB();
            return !!db.sessions[sessionId];
        }
        try {
            const snap = await getDoc(doc(db, "sessions", sessionId));
            return snap.exists();
        } catch (e) {
            console.error("Firebase Connection Failed. Switching to Offline/Mock Mode.", e);
            USE_FALLBACK = true; // GLOBAL FALLBACK TRIGGER
            // Retry with mock (likely false, but sets the mode for future)
            return false;
        }
    },

    async createSession(): Promise<string> {
        if (USE_MOCK || USE_FALLBACK) {
            const db = getLocalDB();
            const id = "sess_" + Date.now();
            const newSession: DesignSession = {
                id,
                clientName: `Client-${Math.floor(Math.random() * 1000)}`,
                createdAt: new Date(),
                started: false
            };
            db.sessions[id] = newSession;
            db.messages[id] = {}; // Init message bucket
            saveLocalDB(db);
            return id;
        }
        // Real Firebase
        try {
            const ref = await addDoc(collection(db, "sessions"), {
                clientName: `Client-${Math.floor(Math.random() * 1000)}`,
                createdAt: serverTimestamp(),
                started: false
            });
            return ref.id;
        } catch (error) {
            console.error("Firebase Create Failed. Switching to Fallback.", error);
            USE_FALLBACK = true;
            return this.createSession(); // Retry recursively with fallback enabled
        }
    },

    async startSession(sessionId: string) {
        if (USE_MOCK || USE_FALLBACK) {
            const db = getLocalDB();
            if (db.sessions[sessionId]) {
                db.sessions[sessionId].started = true;
                saveLocalDB(db);
            }
            return;
        }
        await updateDoc(doc(db, "sessions", sessionId), { started: true });
    },

    async updateSessionPendingDesign(sessionId: string, pendingDesign: unknown) {
        if (USE_MOCK || USE_FALLBACK) {
            const db = getLocalDB();
            if (!db.sessions[sessionId]) {
                console.error("[STORAGE] Session not found in mock DB:", sessionId);
                return;
            }
            db.sessions[sessionId].pendingDesign = pendingDesign;
            saveLocalDB(db);
            console.log("[STORAGE] Mock: pendingDesign updated");
            return;
        }

        try {
            console.log("[STORAGE] Updating Firestore pendingDesign for session:", sessionId);
            await updateDoc(doc(db, "sessions", sessionId), { pendingDesign });
            console.log("[STORAGE] Firestore: pendingDesign updated successfully");
        } catch (error) {
            console.error("[STORAGE] Failed to update pendingDesign:", error);
            throw error;
        }
    },

    // --- Messages ---

    async addMessage(sessionId: string, message: Partial<Message>) {
        const finalMessage = {
            ...message,
            timestamp: (USE_MOCK || USE_FALLBACK) ? new Date() : serverTimestamp()
        };

        if (USE_MOCK || USE_FALLBACK) {
            const db = getLocalDB();
            const id = "msg_" + Date.now();

            finalMessage.id = id;

            if (!db.messages[sessionId]) db.messages[sessionId] = {};
            db.messages[sessionId][id] = finalMessage;
            saveLocalDB(db);
            return;
        }

        await addDoc(collection(db, `sessions/${sessionId}/messages`), finalMessage);
    },

    async updateMessage(sessionId: string, messageId: string, updates: Partial<Message>) {
        if (USE_MOCK || USE_FALLBACK) {
            const db = getLocalDB();
            if (db.messages[sessionId] && db.messages[sessionId][messageId]) {
                db.messages[sessionId][messageId] = { ...db.messages[sessionId][messageId], ...updates };
                saveLocalDB(db);
            }
            return;
        }
        await updateDoc(doc(db, `sessions/${sessionId}/messages`, messageId), updates);
    },

    // --- Listeners (The Tricky Part) ---

    subscribeToSession(sessionId: string, callback: (data: any) => void) {
        // We can't easily auto-switch inside a listener setup because it returns an unsubscribe function.
        // But if USE_FALLBACK is already true, we use the mock.
        if (USE_MOCK || USE_FALLBACK) {
            // Poll or Listener
            const check = () => {
                const db = getLocalDB();


                const s = db.sessions[sessionId];
                if (s) callback(s);
            };

            check(); // Initial
            const interval = setInterval(check, 1000); // Poll every 1s
            const handler = () => check();
            window.addEventListener('storage-update', handler);

            return () => {
                clearInterval(interval);
                window.removeEventListener('storage-update', handler);
            };
        }


        // Firebase
        try {
            return onSnapshot(
                doc(db, "sessions", sessionId),
                { includeMetadataChanges: false }, // Only trigger on server changes, not cache
                (snapshot) => {
                    if (snapshot.exists()) {
                        const data = snapshot.data();
                        console.log("[STORAGE] Session snapshot received, from cache?", snapshot.metadata.fromCache);
                        console.log("[STORAGE] Session data:", data);
                        callback(data);
                    }
                }
            );
        } catch (e) {
            console.error("Firebase Listen Failed (Session)", e);
            USE_FALLBACK = true;
            return () => { };
        }
    },

    subscribeToMessages(sessionId: string, callback: (messages: Message[]) => void) {
        if (USE_MOCK || USE_FALLBACK) {
            const check = () => {
                const db = getLocalDB();
                const msgsObj = db.messages[sessionId] || {};
                const msgs = Object.values(msgsObj).sort((a, b) => {
                    const tA = (a as Message).timestamp;
                    const tB = (b as Message).timestamp;
                    return new Date(tA as any).getTime() - new Date(tB as any).getTime();
                });
                callback(msgs as Message[]);
            };

            check();
            const interval = setInterval(check, 1000);
            const handler = () => check();
            window.addEventListener('storage-update', handler);

            return () => {
                clearInterval(interval);
                window.removeEventListener('storage-update', handler);
            };
        }

        const q = query(collection(db, `sessions/${sessionId}/messages`), orderBy("timestamp", "asc"));
        return onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                timestamp: d.data().timestamp?.toDate ? d.data().timestamp.toDate() : new Date()
            })) as Message[];
            callback(msgs);
        });
    },

    // --- One-off Fetch ---
    async getAllSessions(): Promise<DesignSession[]> {
        if (USE_MOCK || USE_FALLBACK) {
            const db = getLocalDB();
            const sess = Object.values(db.sessions);
            return sess as DesignSession[];
        }

        // Firebase
        const snapshot = await getDocs(collection(db, "sessions"));
        return snapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
        })) as DesignSession[];
    },

    subscribeToAllSessions(callback: (sessions: DesignSession[]) => void) {
        if (USE_MOCK || USE_FALLBACK) {
            const check = () => {
                const db = getLocalDB();
                const sess = Object.values(db.sessions).sort((a, b) => {
                    const tA = (a as DesignSession).createdAt;
                    const tB = (b as DesignSession).createdAt;
                    return new Date(tB as any).getTime() - new Date(tA as any).getTime();
                });
                callback(sess as DesignSession[]);
            };
            check();
            const interval = setInterval(check, 2000);
            const handler = () => check();
            window.addEventListener('storage-update', handler);

            return () => {
                clearInterval(interval);
                window.removeEventListener('storage-update', handler);
            };
        }

        // Firebase - Remove OrderBy to prevent "Missing Index" failures
        return onSnapshot(collection(db, "sessions"), (snapshot) => {
            const sess = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            })) as DesignSession[];

            // Client-side sort
            const sorted = sess.sort((a, b) => {
                // Handle standard Date object or Firestore Timestamp
                const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
                const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
                return timeB - timeA;
            });

            callback(sorted);
        });
    }
};
