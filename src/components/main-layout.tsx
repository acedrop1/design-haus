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

            if (!storedId) {
                // Create new session via Service
                storedId = await StorageService.createSession();
                localStorage.setItem("designhaus_session_id", storedId);
            }
            setSessionId(storedId);
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
        });

        // Listen to Session (for pendingDesign sync and started status)
        const unsubSession = StorageService.subscribeToSession(sessionId, (data) => {
            if (data) {
                setPendingDesign(data.pendingDesign);
                // removing auto-start to preventing locking user in chat
                // if (data.started) setHasStarted(true); 
            }
        });

        return () => {
            if (unsubMessages) unsubMessages();
            if (unsubSession) unsubSession();
        };
    }, [sessionId]);

    const handleStart = async () => {
        setHasStarted(true);
        if (sessionId) {
            await StorageService.startSession(sessionId);

            // Welcome message if empty
            // Note: We check if messages are empty locally, but service might be async.
            // Small race condition possible, but acceptable for demo.
            if (messages.length === 0) {
                await StorageService.addMessage(sessionId, {
                    role: 'ai',
                    content: `Welcome to DesignHaus! 🍬

We're here to help bring your design ideas to life and ready for **PRINT** in under 10 minutes. You get the file and send it to your print shop.

**To get started:**
1. Describe your idea & flavor name.
2. Attach your **Logo** or brand name (if you have one).
3. Send your **Instagram @handle** so we can create a QR code on the design.

Describe your vision, and you'll receive your file! 🍫`
                });
            }
        }
    };

    const handleExit = () => {
        setHasStarted(false);
    };

    const handleSendMessage = async (text: string, attachments: Attachment[], audioUrl?: string) => {
        if (!sessionId) return;

        // 1. Write User Message to Service
        await StorageService.addMessage(sessionId, {
            role: 'user',
            content: text,
            audioUrl: audioUrl || undefined,
            attachments: attachments
        });

        // 2. Trigger AI
        try {
            const prompt = audioUrl ? `[Voice Note: ${text}]` : text;
            // Also consider attachments in prompt context ideally
            const finalPrompt = attachments.length > 0 ? `[Attachments] ${prompt}` : prompt;

            const result = await generatePackagingDesign(finalPrompt);
            if (result.success && result.imageUrl) {
                // Update Session with Pending Design
                StorageService.updateSessionPendingDesign(sessionId, {
                    originalPrompt: finalPrompt,
                    imageUrl: result.imageUrl,
                    status: 'generated'
                });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleAdminLogin = () => {
        // Admin Login Logic...
        // Note: For localhost demo, we allow easy switching
        const password = window.prompt("Enter Admin Password:");
        if (password === "adam123") {
            setIsAdminMode(true);
            setIsSidebarOpen(true);
        } else {
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
                        <button onClick={handleAdminLogin} className="w-2 h-2 rounded-full bg-zinc-900 hover:bg-[var(--accent-yellow)] transition-colors" />
                    )}
                </div>
            </header>

            <div className="flex-1 relative">
                <ChatInterface
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    onExit={!isAdminMode ? handleExit : undefined}
                />

                {isAdminMode && (
                    <AdminDashboard
                        currentSessionId={sessionId}
                        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                        isSidebarOpen={isSidebarOpen}
                    />
                )}
            </div>
        </div>
    );
}
