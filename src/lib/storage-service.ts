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
    getDoc
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

export const StorageService = {

    // --- Sessions ---

    async verifySession(sessionId: string): Promise<boolean> {
        if (USE_MOCK) {
            const db = getLocalDB();
            return !!db.sessions[sessionId];
        }
        try {
            const snap = await getDoc(doc(db, "sessions", sessionId));
            return snap.exists();
        } catch (e) {
            console.error("Error verifying session:", e);
            return false;
        }
    },

    async createSession() {
        if (USE_MOCK) {
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
        const ref = await addDoc(collection(db, "sessions"), {
            clientName: `Client-${Math.floor(Math.random() * 1000)}`,
            createdAt: serverTimestamp(),
            started: false
        });
        return ref.id;
    },

    async startSession(sessionId: string) {
        if (USE_MOCK) {
            const db = getLocalDB();
            if (db.sessions[sessionId]) {
                db.sessions[sessionId].started = true;
                saveLocalDB(db);
            }
            return;
        }
        await updateDoc(doc(db, "sessions", sessionId), { started: true });
    },

    updateSessionPendingDesign(sessionId: string, pendingDesign: unknown) {
        if (USE_MOCK) {
            const db = getLocalDB();
            if (db.sessions[sessionId]) {
                db.sessions[sessionId].pendingDesign = pendingDesign;
                saveLocalDB(db);
            }
            return;
        }
        // Firebase
        if (pendingDesign === null) {
            updateDoc(doc(db, "sessions", sessionId), { pendingDesign: null });
        } else {
            updateDoc(doc(db, "sessions", sessionId), { pendingDesign });
        }
    },

    // --- Messages ---

    async addMessage(sessionId: string, message: Partial<Message>) {
        const finalMessage = {
            ...message,
            timestamp: USE_MOCK ? new Date() : serverTimestamp()
        };

        if (USE_MOCK) {
            const db = getLocalDB();
            const id = "msg_" + Date.now();
            // @ts-expect-error - id is dynamically added
            finalMessage.id = id;

            if (!db.messages[sessionId]) db.messages[sessionId] = {};
            db.messages[sessionId][id] = finalMessage;
            saveLocalDB(db);
            return;
        }

        await addDoc(collection(db, `sessions/${sessionId}/messages`), finalMessage);
    },

    async updateMessage(sessionId: string, messageId: string, updates: Partial<Message>) {
        if (USE_MOCK) {
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
        if (USE_MOCK) {
            // Poll or Listener
            const check = () => {
                const db = getLocalDB();
                // @ts-expect-error - db structure is loose
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
        return onSnapshot(doc(db, "sessions", sessionId), (doc) => {
            if (doc.exists()) callback(doc.data());
        });
    },

    subscribeToMessages(sessionId: string, callback: (messages: Message[]) => void) {
        if (USE_MOCK) {
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

    subscribeToAllSessions(callback: (sessions: DesignSession[]) => void) {
        if (USE_MOCK) {
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
                // @ts-expect-error - Firestore timestamp compat
                const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
                // @ts-expect-error - Firestore timestamp compat
                const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
                return timeB - timeA;
            });

            callback(sorted);
        });
    }
};
