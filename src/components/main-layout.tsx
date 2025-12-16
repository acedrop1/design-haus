"use client";

import { useState, useEffect } from "react";
import { Message, DesignSession } from "@/types";
import { LandingPage } from "@/components/landing-page";
import { ChatInterface } from "@/components/chat-interface";
import { AdminDashboard } from "@/components/admin-dashboard";
import { generatePackagingDesign } from "@/app/actions";
import { db } from "@/lib/firebase";
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    doc,
    setDoc,
    getDoc,
    updateDoc
} from "firebase/firestore";

export function MainLayout() {
    const [hasStarted, setHasStarted] = useState(false);
    const [isAdminMode, setIsAdminMode] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // IDs
    const [sessionId, setSessionId] = useState<string | null>(null);

    // Data State
    const [messages, setMessages] = useState<Message[]>([]);
    const [pendingDesign, setPendingDesign] = useState<{
        originalPrompt: string;
        imageUrl: string;
        status: 'generated' | 'refined';
    } | undefined>(undefined);

    // 1. Initialize Session
    useEffect(() => {
        const initSession = async () => {
            let storedId = localStorage.getItem("designhaus_session_id");

            if (!storedId) {
                // Create new session
                const sessionRef = await addDoc(collection(db, "sessions"), {
                    clientName: `Client-${Math.floor(Math.random() * 10000)}`,
                    createdAt: serverTimestamp(),
                    started: false
                });
                storedId = sessionRef.id;
                localStorage.setItem("designhaus_session_id", storedId);
            }
            setSessionId(storedId);
        };

        if (typeof window !== 'undefined') {
            initSession();
        }
    }, []);

    // 2. Listen to Messages & Session Data
    useEffect(() => {
        if (!sessionId) return;

        // Listen to Messages
        const q = query(collection(db, `sessions/${sessionId}/messages`), orderBy("timestamp", "asc"));
        const unsubscribeMessages = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                timestamp: d.data().timestamp?.toDate() || new Date() // Convert Firestore Timestamp
            })) as Message[];
            setMessages(msgs);
        });

        // Listen to Session (for pendingDesign sync)
        const unsubscribeSession = onSnapshot(doc(db, "sessions", sessionId), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setPendingDesign(data.pendingDesign);
                if (data.started) setHasStarted(true);
            }
        });

        return () => {
            unsubscribeMessages();
            unsubscribeSession();
        };
    }, [sessionId]);

    const handleStart = async () => {
        setHasStarted(true);
        if (sessionId) {
            await updateDoc(doc(db, "sessions", sessionId), { started: true });

            // Welcome message if empty
            if (messages.length === 0) {
                await addDoc(collection(db, `sessions/${sessionId}/messages`), {
                    role: 'ai',
                    content: "Welcome to DesignHaus. I am your packaging architect. Upload a reference or describe your product concept.",
                    timestamp: serverTimestamp()
                });
            }
        }
    };

    const handleSendMessage = async (text: string) => {
        if (!sessionId) return;

        // 1. Write User Message to Firestore
        await addDoc(collection(db, `sessions/${sessionId}/messages`), {
            role: 'user',
            content: text,
            timestamp: serverTimestamp()
        });

        // 2. Trigger AI (Client-side trigger, updates Firestore)
        // In a real secure app, this would be a Cloud Function listener.
        // Here, the client acts as the orchestrator.
        try {
            const result = await generatePackagingDesign(text);
            if (result.success && result.imageUrl) {
                // Update the Session Document with Pending Design
                // The Admin is listening to this document!
                await updateDoc(doc(db, "sessions", sessionId), {
                    pendingDesign: {
                        originalPrompt: text,
                        imageUrl: result.imageUrl,
                        status: 'generated'
                    }
                });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleAdminLogin = () => {
        const password = window.prompt("Enter Admin Password:");
        if (password === "adam123") {
            setIsAdminMode(true);
            setIsSidebarOpen(true);
        } else {
            alert("Access Denied");
        }
    };

    // --- Admin Actions (Now write to Firestore) ---

    const handleRefine = async (instructions: string) => {
        // In reality, this would perform a new generation. 
        // Here we just update the status so the Client *doesn't* see it yet, but Admin does.
        if (sessionId && pendingDesign) {
            await updateDoc(doc(db, "sessions", sessionId), {
                "pendingDesign.status": "refined",
                // "pendingDesign.imageUrl": newImageUrl // if we had one
            });
        }
    };

    const handleSendProposal = async (price: number) => {
        if (!sessionId || !pendingDesign) return;

        // 1. Add Message
        await addDoc(collection(db, `sessions/${sessionId}/messages`), {
            role: 'ai',
            content: "I have generated a concept based on your specifications. Please unlock the high-resolution render below.",
            timestamp: serverTimestamp(),
            imageUrl: pendingDesign.imageUrl,
            isLocked: true,
            proposalAmount: price,
            isProposal: true,
            isPaid: false
        });

        // 2. Clear Pending Design
        await updateDoc(doc(db, "sessions", sessionId), {
            pendingDesign: null
            // Firestore requires 'deleteField()' normally, or just null/undefined logic.
            // We will set it to null.
        });
    };

    const handleUnlock = async (messageId: string) => {
        if (!sessionId) return;
        // Update the specific message
        const msgRef = doc(db, `sessions/${sessionId}/messages`, messageId);
        await updateDoc(msgRef, {
            isLocked: false,
            isPaid: true
        });
    };

    if (!hasStarted && !isAdminMode) {
        return <LandingPage onStart={handleStart} onAdminLogin={handleAdminLogin} />;
    }

    return (
        <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col">
            <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-black/50 backdrop-blur-md z-40">
                <div className="font-black text-xl tracking-tighter text-white">
                    DESIGN<span className="text-[var(--accent-yellow)]">HAUS</span>
                </div>
                <div className="flex gap-4">
                    {!isAdminMode && (
                        <button onClick={handleAdminLogin} className="w-2 h-2 rounded-full bg-zinc-900 hover:bg-[var(--accent-yellow)] transition-colors" />
                    )}
                </div>
            </header>

            <div className="flex-1 relative">
                <ChatInterface
                    messages={messages}
                    onSendMessage={handleSendMessage}
                />

                {isAdminMode && (
                    <AdminDashboard
                        // In a real app, AdminDashboard would fetch ALL sessions. 
                        // For now, let's pass the CURRENT session ID so it can "manage" it or list others.
                        currentSessionId={sessionId}
                        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                        isSidebarOpen={isSidebarOpen}
                    />
                )}
            </div>
        </div>
    );
}
