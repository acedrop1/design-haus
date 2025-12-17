"use client";

import { useEffect, useState, useRef } from "react";
import { generatePackagingDesign, listAvailableModels } from "@/app/actions";
import {
    Loader2, Send, Wand2, RefreshCcw, Lock, Unlock,
    MessageSquare, ChevronLeft, Image as ImageIcon,
    CheckCircle2, X
} from "lucide-react";
import { StorageService } from "@/lib/storage-service";
import { cn } from "@/lib/utils";
import type { Message, DesignSession } from "@/types";

// Type definitions to match what's used in the component
type Session = DesignSession;
type DesignState = {
    originalPrompt: string;
    imageUrl: string;
    status: 'generated' | 'refined';
};

interface AdminDashboardProps {
    currentSessionId: string;
}

export function AdminDashboard({ currentSessionId }: AdminDashboardProps) {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const [activeMessages, setActiveMessages] = useState<Message[]>([]);
    const [pendingDesign, setPendingDesign] = useState<DesignState | null>(null);
    const [refineText, setRefineText] = useState("");
    const [adminInput, setAdminInput] = useState("");
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [genStatus, setGenStatus] = useState<string | null>(null);
    const isGeneratingRef = useRef(false);

    const onToggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    // Helper function to upload images (URL or base64) to Firebase Storage
    const uploadToStorage = async (dataOrUrl: string, path: string): Promise<string | null> => {
        try {
            setGenStatus("Processing image...");

            // fetch() works for both external URLs and data: URIs
            const response = await fetch(dataOrUrl);
            const blob = await response.blob();

            setGenStatus(`Uploading to Storage (${Math.round(blob.size / 1024)}KB)...`);
            const url = await StorageService.uploadImage(blob, path);
            return url;
        } catch (error) {
            console.error("[ADMIN] Failed to upload image:", error);
            setGenStatus("Upload failed!");
            return null;
        }
    };

    // Unified design generation and saving logic
    const handleDesignWorkflow = async (prompt: string) => {
        if (!selectedSessionId || isGeneratingRef.current) return;

        console.log("🎨 [ADMIN] Starting design workflow for:", prompt);
        setIsGenerating(true);
        isGeneratingRef.current = true;
        setGenStatus("AI is thinking...");

        try {
            const result = await generatePackagingDesign(prompt);
            console.log("🎨 [ADMIN] Generation result:", result);

            if (result.success && result.imageUrl) {
                let finalImageUrl = result.imageUrl;

                // Move image to permanent Storage (either from URL or base64)
                setGenStatus("Storing permanently...");
                const uploadedUrl = await uploadToStorage(result.imageUrl, `designs/${selectedSessionId}/${Date.now()}.png`);

                if (uploadedUrl) {
                    finalImageUrl = uploadedUrl;
                } else {
                    console.error("❌ [ADMIN] Storage upload failed - using temporary link");
                    // If it's a data URI, this might still fail in Firestore later
                }

                setGenStatus("Saving to database...");
                await StorageService.updateSessionPendingDesign(selectedSessionId, {
                    originalPrompt: prompt,
                    imageUrl: finalImageUrl,
                    status: 'generated',
                    timestamp: Date.now() // Track when it was generated to avoid loops
                });
                console.log("✅ [ADMIN] Design saved and updated!");
                setGenStatus(null);
            } else {
                throw new Error(result.error || "Generation failed without error message");
            }
        } catch (error) {
            console.error("❌ [ADMIN] Design Workflow Failed:", error);
            const msg = (error as any).message || String(error);
            setGenStatus("Failure!");
            alert(`DESIGN ERROR: ${msg}\n\nPlease check console for technical details.`);
        } finally {
            setIsGenerating(false);
            isGeneratingRef.current = false;
        }
    };

    // Log state changes can be removed or reduced to errors only
    useEffect(() => {
        if (pendingDesign) {
            console.log("🟡 [STATE] pendingDesign updated:", pendingDesign.status);
        }
        // Debug: Check available models
        listAvailableModels().then(res => console.log("🔍 [ADMIN] Available Models:", res));
    }, [pendingDesign]);

    // Initial Load
    useEffect(() => {
        const load = async () => {
            const all = await StorageService.getAllSessions();
            const sorted = all.sort((a, b) => {
                const tA = new Date(a.createdAt || 0).getTime();
                const tB = new Date(b.createdAt || 0).getTime();
                return tB - tA;
            });
            setSessions(sorted);

            if (currentSessionId && sorted.find(s => s.id === currentSessionId)) {
                setSelectedSessionId(currentSessionId);
            } else if (sorted.length > 0) {
                setSelectedSessionId(sorted[0].id);
            }
        };
        load();
        const interval = setInterval(load, 5000);
        return () => clearInterval(interval);
    }, [currentSessionId]);

    // Listen to Selected Session
    useEffect(() => {
        if (!selectedSessionId) return;

        const unsubMsg = StorageService.subscribeToMessages(selectedSessionId, (msgs) => {
            setActiveMessages(msgs);
        });

        const unsubSess = StorageService.subscribeToSession(selectedSessionId, (sess: any) => {
            console.log("🔔 [ADMIN] Session update received:", sess);
            if (sess) {
                console.log("🔔 [ADMIN] sess.pendingDesign:", sess.pendingDesign);
                setPendingDesign(sess.pendingDesign || null);
                console.log("🔔 [ADMIN] setPendingDesign called with:", sess.pendingDesign || null);
            }
        });

        return () => {
            unsubMsg();
            unsubSess();
        };
    }, [selectedSessionId]);

    // Auto-generate design when admin views session with new client messages
    useEffect(() => {
        console.log("🔍 [ADMIN] Auto-gen check:", {
            selectedSessionId,
            messageCount: activeMessages.length,
            hasPendingDesign: !!pendingDesign,
            hasImageUrl: pendingDesign?.imageUrl ? true : false
        });

        // CHECK: If the last message is already from AI, we don't need to auto-generate
        const lastMessage = activeMessages[activeMessages.length - 1];
        if (lastMessage?.role === 'ai') {
            console.log("⏭️ [ADMIN] Last message is AI, skipping auto-gen");
            return;
        }

        // Find the last client message
        const lastClientMessage = [...activeMessages]
            .reverse()
            .find(msg => msg.role === 'user');

        if (!lastClientMessage) {
            console.log("⏭️ [ADMIN] No client messages found, skipping auto-gen");
            return;
        }

        // PREVENT LOOP: Check if we've already generated/handled this message
        // If the last message isn't from the client, or if the client hasn't spoken since the last design
        // we should probably stop.

        console.log("✅ [ADMIN] Conditions met, will auto-generate from:", lastClientMessage.content);
        handleDesignWorkflow(lastClientMessage.content);
    }, [selectedSessionId, activeMessages, pendingDesign, isGenerating]);

    // Actions
    const handleGenerateDesign = async () => {
        console.log("🔴 [ADMIN] manual handleGenerateDesign CALLED");

        if (!selectedSessionId || !activeMessages.length) {
            console.log("❌ [ADMIN] Early return - no session or messages");
            return;
        }

        const lastClientMessage = [...activeMessages]
            .reverse()
            .find(msg => msg.role === 'user');

        if (!lastClientMessage) {
            alert("No client message found to generate from");
            return;
        }

        await handleDesignWorkflow(lastClientMessage.content);
    };

    const handleRefine = async () => {
        if (!selectedSessionId || !pendingDesign) return;
        await StorageService.updateSessionPendingDesign(selectedSessionId, {
            ...pendingDesign,
            status: 'refined'
        });
        setRefineText("");
    };

    const handleSendProposal = async (price: number) => {
        if (!selectedSessionId || !pendingDesign) return;

        await StorageService.addMessage(selectedSessionId, {
            role: 'ai',
            content: "I have generated a concept based on your specifications. Please unlock the high-resolution render below.",
            imageUrl: pendingDesign.imageUrl,
            isLocked: true,
            proposalAmount: price,
            isProposal: true,
            isPaid: false
        });

        await StorageService.updateSessionPendingDesign(selectedSessionId, null);
    };

    const handleAdminMessage = async () => {
        if (!selectedSessionId || !adminInput.trim()) return;

        await StorageService.addMessage(selectedSessionId, {
            role: 'ai',
            content: adminInput
        });
        setAdminInput("");
    };

    const handleUnlock = async (messageId: string) => {
        if (!selectedSessionId) return;
        await StorageService.updateMessage(selectedSessionId, messageId, {
            isLocked: false,
            isPaid: true
        });
    };

    const handleClearStaging = async () => {
        if (!selectedSessionId) return;
        if (!confirm("Clear the staging area? This will allow you to regenerate a new design.")) return;
        await StorageService.updateSessionPendingDesign(selectedSessionId, null);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black flex font-sans">
            {/* Sidebar (Original Design) */}
            <div
                className={cn(
                    "bg-zinc-950 border-r border-zinc-800 w-80 h-full transform transition-transform duration-300 flex flex-col absolute md:relative z-20",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                )}
            >
                <div className="p-6 border-b border-zinc-800 bg-black">
                    <h2 className="text-[var(--accent-yellow)] font-bold text-xl uppercase tracking-tighter">Admin Console</h2>
                    <p className="text-zinc-500 text-xs mt-1 mb-2">DesignHaus Internal v2.5</p>
                    <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full animate-pulse",
                            process.env.NEXT_PUBLIC_FIREBASE_API_KEY && !process.env.NEXT_PUBLIC_FIREBASE_API_KEY.startsWith("mock_")
                                ? "bg-green-500"
                                : "bg-red-500"
                        )} />
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider">
                            {process.env.NEXT_PUBLIC_FIREBASE_API_KEY && !process.env.NEXT_PUBLIC_FIREBASE_API_KEY.startsWith("mock_")
                                ? "System: Online"
                                : "System: Local Mode"}
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Sessions</div>
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => setSelectedSessionId(session.id)}
                            className={cn(
                                "border p-4 rounded-lg cursor-pointer transition-colors",
                                selectedSessionId === session.id
                                    ? "bg-zinc-900 border-[var(--accent-yellow)]/50"
                                    : "bg-black border-zinc-800 hover:border-zinc-700"
                            )}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-white font-medium text-sm">{session.clientName}</span>
                                <span className="text-[10px] text-zinc-600">{session.id.slice(0, 8)}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Pending Unlocks Panel */}
                <div className="p-4 border-t border-zinc-800 bg-black/50">
                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Pending Unlocks</div>
                    <div className="space-y-2">
                        {activeMessages.filter(m => m.isLocked).map(m => (
                            <div key={m.id} className="flex justify-between items-center bg-zinc-900 p-2 rounded border border-zinc-800">
                                <span className="text-xs text-zinc-300">Prop ${m.proposalAmount}</span>
                                <button
                                    onClick={() => handleUnlock(m.id)}
                                    className="text-[10px] bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded uppercase font-bold"
                                >
                                    Mark Paid
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col h-full relative bg-black">
                {/* Top Bar */}
                <div className="h-16 flex items-center justify-between px-6 bg-transparent z-10 w-full border-b border-zinc-900">
                    <div className="flex gap-2">
                        <button
                            onClick={onToggleSidebar}
                            className="bg-[var(--accent-yellow)] text-black px-4 py-2 font-bold uppercase tracking-widest text-sm hover:bg-white transition-colors"
                        >
                            {isSidebarOpen ? "Close Menu" : "Menu"}
                        </button>
                        <button
                            onClick={handleGenerateDesign}
                            disabled={isGenerating}
                            className={cn(
                                "text-white px-4 py-2 font-bold uppercase tracking-widest text-sm transition-colors flex items-center gap-2",
                                isGenerating ? "bg-zinc-800 cursor-not-allowed" : "bg-green-600 hover:bg-green-500"
                            )}
                        >
                            {isGenerating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Wand2 className="w-4 h-4" />
                            )}
                            {isGenerating ? genStatus || "Generating..." : "Generate Design"}
                        </button>
                    </div>
                    <div className="bg-black/80 backdrop-blur border border-zinc-800 px-4 py-2 rounded-full text-zinc-400 text-xs font-mono">
                        Target: {selectedSessionId === currentSessionId ? "This Device" : selectedSessionId?.slice(0, 6)}
                    </div>
                </div>

                {/* Chat History (New Improved View) */}
                <div className="absolute inset-0 pt-20 pb-20 px-4 md:px-8 overflow-y-auto" style={{ willChange: 'transform' }}>
                    <div className="max-w-4xl mx-auto space-y-4">
                        {selectedSessionId ? (
                            activeMessages.length > 0 ? (
                                activeMessages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={cn(
                                            "flex w-full",
                                            msg.role === 'user' ? "justify-start" : "justify-end"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "max-w-[70%] md:max-w-[60%] p-4 rounded-2xl text-sm relative group",
                                                msg.role === 'user'
                                                    ? "bg-[#1E1E24] text-gray-200 rounded-tl-sm"
                                                    : "bg-[var(--accent-yellow)] text-black rounded-tr-sm font-medium"
                                            )}
                                        >
                                            <div className="text-[10px] opacity-50 mb-1 uppercase tracking-wider font-bold">
                                                {msg.role === 'user' ? "Client" : "Designer"}
                                            </div>

                                            {msg.content && <div className="leading-relaxed">{msg.content}</div>}

                                            {msg.imageUrl && (
                                                <div className="mt-2 rounded overflow-hidden border border-black/10">
                                                    <img src={msg.imageUrl} alt="Design" className="w-full h-auto object-cover" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-zinc-600 mt-20">No messages in this session</div>
                            )
                        ) : (
                            <div className="text-center text-zinc-600 mt-20">Select a session to view chat</div>
                        )}
                        <div className="h-24"></div>
                    </div>
                </div>

                {/* Staging Area (Original Sidebar Overlay Style) */}
                {pendingDesign && (
                    <div className="absolute top-20 right-8 w-96 bg-zinc-900/95 backdrop-blur-md border border-[var(--accent-yellow)]/30 rounded-xl shadow-2xl overflow-hidden flex flex-col z-30">
                        <div className="p-3 bg-black border-b border-zinc-800 flex justify-between items-center">
                            <h3 className="text-white text-sm font-bold uppercase flex items-center gap-2">
                                <Wand2 className="w-4 h-4 text-[var(--accent-yellow)]" /> Staging Area
                            </h3>
                            <button
                                onClick={handleClearStaging}
                                className="text-[10px] text-zinc-500 hover:text-red-400 uppercase transition-colors"
                            >
                                Clear
                            </button>
                        </div>

                        <div className="relative aspect-[4/5] bg-black/50">
                            {isGenerating ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 p-6 text-center">
                                    <Loader2 className="w-10 h-10 text-[var(--accent-yellow)] animate-spin mb-4" />
                                    <div className="text-[var(--accent-yellow)] font-bold uppercase tracking-widest text-xs">{genStatus}</div>
                                    <div className="text-zinc-500 text-[10px] mt-2 italic px-4">DALL-E 3 is creating your high-res vision. Please don't refresh.</div>
                                </div>
                            ) : null}
                            <img
                                src={pendingDesign.imageUrl}
                                className={cn("w-full h-full object-contain transition-opacity duration-500", isGenerating ? "opacity-30" : "opacity-100")}
                                alt="Staged"
                                onError={(e) => {
                                    console.error("Image load failed, showing placeholder");
                                    e.currentTarget.src = "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?q=80&w=800";
                                }}
                            />
                        </div>

                        <div className="p-4 space-y-3">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={refineText}
                                    onChange={(e) => setRefineText(e.target.value)}
                                    placeholder="Refine..."
                                    className="flex-1 bg-black border border-zinc-700 rounded px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-[var(--accent-yellow)] outline-none"
                                />
                                <button
                                    onClick={handleRefine}
                                    className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded text-xs"
                                >
                                    <RefreshCcw className="w-4 h-4" />
                                </button>
                            </div>

                            <button
                                onClick={() => handleSendProposal(25)}
                                className="w-full bg-[var(--accent-yellow)] hover:bg-white text-black font-bold py-3 rounded text-sm uppercase tracking-wider flex items-center justify-center gap-2"
                            >
                                Send Proposal ($25) <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Floating Input Bar (New feature kept) */}
                <div className="absolute bottom-6 left-0 right-0 px-4 md:px-0 flex justify-center z-40">
                    <div className="w-full max-w-2xl bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl p-2 flex gap-2">
                        <button className="p-3 text-zinc-500 hover:text-white transition-colors">
                            <ImageIcon className="w-5 h-5" />
                        </button>
                        <input
                            value={adminInput}
                            onChange={(e) => setAdminInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdminMessage()}
                            placeholder="Message the client..."
                            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none"
                        />
                        <button
                            onClick={handleAdminMessage}
                            className="p-3 bg-[var(--accent-yellow)] hover:bg-white text-black rounded-lg transition-colors"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>

    );
}
