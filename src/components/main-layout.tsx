"use client";

import { useState, useEffect } from "react";
import { Message, DesignSession, Attachment } from "@/types";
import { LandingPage } from "@/components/landing-page";
import { ChatInterface } from "@/components/chat-interface";
import { AdminDashboard } from "@/components/admin-dashboard";
import { generatePackagingDesign } from "@/app/actions";
import { StorageService } from "@/lib/storage-service";

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

            // Verify if this ID actually exists in the current Backend (Mock or Real)
            let isValid = false;
            if (storedId) {
                isValid = await StorageService.verifySession(storedId);
            }

            if (!storedId || !isValid) {
                // Create new session via Service
                storedId = await StorageService.createSession();
                if (storedId) localStorage.setItem("designhaus_session_id", storedId);
            }
            if (storedId) setSessionId(storedId);
        };

        if (typeof window !== 'undefined') {
            initSession();
        }
    }, []);

    // 2. Listen to Messages & Session Data via Service
    useEffect(() => {
        if (!sessionId) return;

        // Listen to Messages
        const unsubMessages = StorageService.subscribeToMessages(sessionId, (msgs) => {
            setMessages(msgs);

            // Self-Healing Intro: If we connected but there are NO messages,
            // (e.g. refresh, failed first write, or just empty), inject the intro logic.
            if (msgs.length === 0) {
                const introKey = `intro_sent_${sessionId}`;

                const introMsg: Message = {
                    id: "intro-temp-" + Date.now(),
                    role: 'ai',
                    content: `Welcome to DesignHaus! 🍬

We're here to help bring your design ideas to life and ready for **PRINT** in under 10 minutes. You get the file and send it to your print shop.

**To get started:**
1. Describe your idea & flavor name.
2. Attach your **Logo** or brand name (if you have one).
3. Send your **Instagram @handle** so we can create a QR code on the design.

Describe your vision, and you'll receive your file! 🍫`,
                    timestamp: new Date() as unknown as any // Firebase timestamp compat
                };

                // 1. ALWAYS Show it INSTANTLY (Optimistic Visual Fix)
                // This ensures the user NEVER sees an empty screen.
                setMessages([introMsg]);

                // 2. Only Write to DB if we haven't done so for this session
                if (!localStorage.getItem(introKey)) {
                    localStorage.setItem(introKey, "true");
                    StorageService.addMessage(sessionId, introMsg);
                }
            }
        });

        // Listen to Session (for pendingDesign sync and started status)
        const unsubSession = StorageService.subscribeToSession(sessionId, (data) => {
            if (data) {
                setPendingDesign(data.pendingDesign);
            }
        });

        return () => {
            if (unsubMessages) unsubMessages();
            if (unsubSession) unsubSession();
        };
    }, [sessionId]);

    const handleStart = async () => {
        // Optimistic UI: Switch immediately so the user sees progress
        // This makes the button feel "instant" even if DB is slow
        setHasStarted(true);

        try {
            let currentSessionId = sessionId;

            // Race Condition Fix: If Start is clicked before initSession completes,
            // force create a session immediately so the user isn't blocked.
            if (!currentSessionId) {
                currentSessionId = await StorageService.createSession();
                setSessionId(currentSessionId);
                localStorage.setItem("designhaus_session_id", currentSessionId);
            }

            // Add intro message FIRST, then mark as started
            // This guarantees ordering
            await StorageService.addMessage(currentSessionId, {
                role: 'ai',
                content: `Welcome to DesignHaus! 🍬

We're here to help bring your design ideas to life and ready for **PRINT** in under 10 minutes. You get the file and send it to your print shop.

**To get started:**
1. Describe your idea & flavor name.
2. Attach your **Logo** or brand name (if you have one).
3. Send your **Instagram @handle** so we can create a QR code on the design.

Describe your vision, and you'll receive your file! 🍫`
            });

            await StorageService.startSession(currentSessionId);
        } catch (error) {
            console.error("Critical Start Error:", error);
            alert("Failed to start project (Connection Error). Please refresh.");
            // Ideally fallback to offline mode here
            setHasStarted(true);
        }
    };

    const handleExit = () => {
        setHasStarted(false);
    };

    const handleSendMessage = async (text: string, attachments: Attachment[], audioUrl?: string) => {
        if (!sessionId) return;

        console.log("📤 Client sending message:", text);

        try {
            const userMessage: any = {
                role: 'user',
                content: text,
                attachments: attachments
            };

            // Only add audioUrl if it exists (Firebase doesn't accept undefined)
            if (audioUrl) {
                userMessage.audioUrl = audioUrl;
            }

            await StorageService.addMessage(sessionId, userMessage);
            console.log("✅ Client message sent successfully");
        } catch (error) {
            console.error("❌ CRITICAL: Message Send Failed:", error);
            alert("Could not send message. Please check your connection.");
        }

        // NOTE: AI generation now happens in Admin view, not here
    };

    const handleAdminLogin = () => {
        const password = window.prompt("Enter Admin Password:");
        if (password === "adam123") {
            setIsAdminMode(true);
            setIsSidebarOpen(true);
        } else if (password) {
            alert("Access Denied");
        }
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
                        <button
                            onClick={handleAdminLogin}
                            className="w-2 h-2 rounded-full bg-zinc-900 hover:bg-[var(--accent-yellow)] transition-colors"
                            title="Admin Access"
                        />
                    )}
                </div>
            </header>

            <div className="flex-1 relative">
                {!isAdminMode && (
                    <ChatInterface
                        messages={messages}
                        onSendMessage={handleSendMessage}
                        onExit={handleExit}
                    />
                )}

                {isAdminMode && (
                    <AdminDashboard
                        currentSessionId={sessionId || ""}
                    />
                )}
            </div>
        </div>
    );
}
