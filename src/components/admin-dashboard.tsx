"use client";

import { useEffect, useState, useRef } from "react";
import {
    Loader2, Send, Wand2, RefreshCcw, Lock, Unlock,
    MessageSquare, ChevronLeft, Image as ImageIcon,
    CheckCircle2, X
} from "lucide-react";
import { StorageService, type Session, type Message, type DesignState } from "@/lib/storage-service";
import { cn } from "@/lib/utils";

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
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Initial Load
    useEffect(() => {
        const load = async () => {
            const all = await StorageService.getAllSessions();
            // Sort by most recent
            const sorted = all.sort((a, b) => b.lastActive - a.lastActive);
            setSessions(sorted);

            // Auto-select the current session if valid, or the first one
            if (currentSessionId && sorted.find(s => s.id === currentSessionId)) {
                setSelectedSessionId(currentSessionId);
            } else if (sorted.length > 0) {
                setSelectedSessionId(sorted[0].id);
            }
        };
        load();

        // Poll for new sessions every 5s
        const interval = setInterval(load, 5000);
        return () => clearInterval(interval);
    }, [currentSessionId]);

    // Listen to Selected Session
    useEffect(() => {
        if (!selectedSessionId) return;

        // Subscribe to messages
        const unsubMsg = StorageService.subscribeToMessages(selectedSessionId, (msgs) => {
            setActiveMessages(msgs);
        });

        // Subscribe to session state (for pending design)
        const unsubSess = StorageService.subscribeToSession(selectedSessionId, (sess: Session | null) => {
            if (sess) {
                setPendingDesign(sess.pendingDesign || null);
            }
        });

        return () => {
            unsubMsg();
            unsubSess();
        };
    }, [selectedSessionId]);

    // Actions
    const handleRefine = async () => {
        if (!selectedSessionId || !pendingDesign) return;
        // Mock refinement
        await StorageService.updateSessionPendingDesign(selectedSessionId, {
            ...pendingDesign,
            status: 'refined'
        });
        setRefineText("");
    };

    const handleSendProposal = async (price: number) => {
        if (!selectedSessionId || !pendingDesign) return;

        // Add Message
        await StorageService.addMessage(selectedSessionId, {
            role: 'ai',
            content: "I have generated a concept based on your specifications. Please unlock the high-resolution render below.",
            imageUrl: pendingDesign.imageUrl,
            isLocked: true,
            proposalAmount: price,
            isProposal: true,
            isPaid: false
        });

        // Clear Pending
        await StorageService.updateSessionPendingDesign(selectedSessionId, null);
    };

    const handleAdminMessage = async () => {
        if (!selectedSessionId || !adminInput.trim()) return;

        // Admin acts as "AI/Designer"
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

    return (
        <div className="fixed inset-0 bg-black text-white z-50 font-sans flex flex-col">
            {/* Header */}
            <header className="h-16 border-b border-zinc-900 bg-black flex items-center justify-between px-6 z-20">
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-white">
                        <MessageSquare />
                    </button>
                    <h1 className="text-xl font-bold tracking-tight text-white uppercase">PackHaus</h1>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest hidden md:block">
                        Session: {selectedSessionId?.slice(0, 8)}
                    </span>
                    <div className="px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900 text-[10px] font-bold text-[var(--accent-yellow)] uppercase tracking-wider flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Designer View
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Session Sidebar (Collapsible) */}
                <div className={cn(
                    "w-64 bg-zinc-950 border-r border-zinc-900 flex-col transition-all duration-300 absolute md:relative z-10 h-full",
                    isMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
                )}>
                    <div className="p-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Active Clients</div>
                    <div className="overflow-y-auto flex-1 space-y-1 p-2">
                        {sessions.map(s => (
                            <button
                                key={s.id}
                                onClick={() => { setSelectedSessionId(s.id); setIsMenuOpen(false); }}
                                className={cn(
                                    "w-full text-left p-3 rounded-lg text-xs transition-colors border",
                                    selectedSessionId === s.id
                                        ? "bg-zinc-900 border-[var(--accent-yellow)]/50 text-white"
                                        : "border-transparent text-zinc-400 hover:bg-zinc-900"
                                )}
                            >
                                <div className="font-medium text-white mb-1 truncate">{s.clientName}</div>
                                <div className="flex justify-between">
                                    <span>#{s.id.slice(0, 4)}</span>
                                    <span>{new Date(s.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className="flex-1 relative flex flex-col bg-black">
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 pb-32">
                        {activeMessages.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-zinc-700 text-sm uppercase tracking-widest">
                                No messages in this session
                            </div>
                        ) : (
                            activeMessages.map((msg) => (
                                <div key={msg.id} className={cn("flex w-full", msg.role === 'user' ? "justify-start" : "justify-end")}>
                                    <div className={cn(
                                        "max-w-[70%] md:max-w-[50%] p-4 rounded-2xl text-sm relative group",
                                        msg.role === 'user'
                                            ? "bg-[#1E1E24] text-gray-200 rounded-tl-sm"
                                            : "bg-[var(--accent-yellow)] text-black rounded-tr-sm font-medium"
                                    )}>
                                        <div className="text-[10px] opacity-50 mb-1 uppercase tracking-wider font-bold">
                                            {msg.role === 'user' ? "Client" : "Designer"}
                                        </div>

                                        {msg.content && <div className="leading-relaxed">{msg.content}</div>}

                                        {msg.imageUrl && (
                                            <div className="mt-3 relative rounded-lg overflow-hidden border border-black/10">
                                                <img src={msg.imageUrl} className={cn("w-full h-auto object-cover", msg.isLocked && "blur-md scale-105")} alt="Design" />
                                                {msg.isLocked && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                        <Lock className="w-6 h-6 text-white drop-shadow-md" />
                                                    </div>
                                                )}
                                                {msg.isLocked && (
                                                    <button
                                                        onClick={() => handleUnlock(msg.id)}
                                                        className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        UNLOCK
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Pending Design Modal (Centered Card) */}
                    {pendingDesign && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                            <div className="w-full max-w-md bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
                                {/* Header */}
                                <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/50">
                                    <div className="flex items-center gap-2 text-[var(--accent-yellow)] text-xs font-bold uppercase tracking-wider">
                                        <Wand2 className="w-3 h-3" /> New Design Generated
                                    </div>
                                    <span className="text-[10px] px-2 py-1 bg-zinc-800 rounded text-zinc-400 uppercase">Admin View</span>
                                </div>

                                {/* Image Preview */}
                                <div className="relative aspect-[4/5] bg-black group">
                                    <img src={pendingDesign.imageUrl} className="w-full h-full object-contain" alt="Generated" />
                                    <div className="absolute bottom-4 right-4 flex gap-2">
                                        <button className="bg-black/50 hover:bg-black text-white p-2 rounded-full backdrop-blur transition-colors">
                                            <ImageIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="p-4 bg-zinc-900 space-y-3">
                                    <div className="flex gap-2">
                                        <input
                                            value={refineText}
                                            onChange={(e) => setRefineText(e.target.value)}
                                            placeholder="Refine (e.g. 'Add QR code to bottom left')"
                                            className="flex-1 bg-black border border-zinc-700 rounded px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-zinc-500 outline-none"
                                        />
                                        <button
                                            onClick={handleRefine}
                                            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded uppercase tracking-wider"
                                        >
                                            Refine
                                        </button>
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={() => StorageService.updateSessionPendingDesign(selectedSessionId!, null)}
                                            className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-bold uppercase tracking-wider rounded transition-colors"
                                        >
                                            Discard
                                        </button>
                                        <button
                                            onClick={() => handleSendProposal(25)}
                                            className="flex-[2] py-3 bg-[var(--accent-yellow)] hover:bg-white text-black text-xs font-bold uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2"
                                        >
                                            Send Proposal ($25)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Input Bar (Floating) */}
                    <div className="absolute bottom-6 left-0 right-0 px-4 md:px-0 flex justify-center pointer-events-none">
                        <div className="w-full max-w-2xl bg-[#18181b] border border-zinc-800 rounded-xl shadow-2xl p-2 flex gap-2 pointer-events-auto">
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
        </div>
    );
}
