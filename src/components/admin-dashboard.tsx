import { useState, useEffect } from "react";
import { Menu, Wand2, Send, RefreshCcw } from "lucide-react";
import { Message, DesignSession } from "@/types";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    doc,
    updateDoc,
    serverTimestamp,
    addDoc
} from "firebase/firestore";

interface AdminDashboardProps {
    currentSessionId: string | null;
    onToggleSidebar: () => void;
    isSidebarOpen: boolean;
}

export function AdminDashboard({
    currentSessionId,
    onToggleSidebar,
    isSidebarOpen
}: AdminDashboardProps) {
    // State
    const [sessions, setSessions] = useState<DesignSession[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(currentSessionId);

    // Selected Session Data
    const [activeMessages, setActiveMessages] = useState<Message[]>([]);
    const [pendingDesign, setPendingDesign] = useState<{
        originalPrompt: string;
        imageUrl: string;
        status: 'generated' | 'refined';
    } | undefined>(undefined);

    const [refineText, setRefineText] = useState("");

    // 1. Listen to All Sessions
    useEffect(() => {
        const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snapshot) => {
            const sess = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data()
            })) as DesignSession[];
            setSessions(sess);
        });
        return () => unsub();
    }, []);

    // 2. Listen to Selected Session
    useEffect(() => {
        if (!selectedSessionId) return;

        // Sync Messages
        const qMsg = query(collection(db, `sessions/${selectedSessionId}/messages`), orderBy("timestamp", "asc"));
        const unsubMsg = onSnapshot(qMsg, (snapshot) => {
            const msgs = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                timestamp: d.data().timestamp?.toDate ? d.data().timestamp.toDate() : new Date()
            })) as Message[];
            setActiveMessages(msgs);
        });

        // Sync Session Pending Design
        const unsubSess = onSnapshot(doc(db, "sessions", selectedSessionId), (d) => {
            if (d.exists()) {
                setPendingDesign(d.data().pendingDesign);
            }
        });

        return () => {
            unsubMsg();
            unsubSess();
        };
    }, [selectedSessionId]);

    // Actions
    const handleRefine = async () => {
        // In a real app, trigger logic. Here, update status.
        if (!selectedSessionId || !pendingDesign) return;
        await updateDoc(doc(db, "sessions", selectedSessionId), {
            "pendingDesign.status": "refined"
        });
        setRefineText("");
    };

    const handleSendProposal = async (price: number) => {
        if (!selectedSessionId || !pendingDesign) return;

        // Add Message
        await addDoc(collection(db, `sessions/${selectedSessionId}/messages`), {
            role: 'ai',
            content: "I have generated a concept based on your specifications. Please unlock the high-resolution render below.",
            timestamp: serverTimestamp(),
            imageUrl: pendingDesign.imageUrl,
            isLocked: true,
            proposalAmount: price,
            isProposal: true,
            isPaid: false
        });

        // Clear Pending
        await updateDoc(doc(db, "sessions", selectedSessionId), {
            pendingDesign: null
        });
    };

    const handleUnlock = async (messageId: string) => {
        if (!selectedSessionId) return;
        await updateDoc(doc(db, `sessions/${selectedSessionId}/messages`, messageId), {
            isLocked: false,
            isPaid: true
        });
    };

    return (
        <div className="fixed inset-0 z-50 pointer-events-none flex">
            {/* Sidebar */}
            <div
                className={cn(
                    "bg-zinc-950 border-r border-zinc-800 w-80 h-full transform transition-transform duration-300 pointer-events-auto flex flex-col",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="p-6 border-b border-zinc-800 bg-black">
                    <h2 className="text-[var(--accent-yellow)] font-bold text-xl uppercase tracking-tighter">Admin Console</h2>
                    <p className="text-zinc-500 text-xs mt-1">DesignHaus Internal v2.5</p>
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
                                <span className="text-[10px] text-zinc-600">{session.id.slice(0, 4)}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Action Log / Unlocks for SELECTED session */}
                <div className="p-4 border-t border-zinc-800 bg-black/50">
                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Pending Unlocks (Current)</div>
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

            {/* Main Admin Overlay (Staging Area) */}
            <div className="flex-1 flex flex-col h-full pointer-events-none relative">
                <div className="h-16 flex items-center justify-between px-6 pointer-events-auto bg-transparent">
                    <button
                        onClick={onToggleSidebar}
                        className="bg-[var(--accent-yellow)] text-black px-4 py-2 font-bold uppercase tracking-widest text-sm hover:bg-white transition-colors"
                    >
                        {isSidebarOpen ? "Close Menu" : "Menu"}
                    </button>
                    <div className="bg-black/80 backdrop-blur border border-zinc-800 px-4 py-2 rounded-full text-zinc-400 text-xs font-mono">
                        Target: {selectedSessionId === currentSessionId ? "This Device" : selectedSessionId?.slice(0, 6)}
                    </div>
                </div>

                {pendingDesign && (
                    <div className="absolute top-20 right-8 w-96 bg-zinc-900/95 backdrop-blur-md border border-[var(--accent-yellow)]/30 rounded-xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col">
                        <div className="p-3 bg-black border-b border-zinc-800 flex justify-between items-center">
                            <h3 className="text-white text-sm font-bold uppercase flex items-center gap-2">
                                <Wand2 className="w-4 h-4 text-[var(--accent-yellow)]" /> Staging Area
                            </h3>
                            <span className="text-[10px] text-zinc-500 uppercase">{pendingDesign.status}</span>
                        </div>

                        <div className="relative aspect-[4/5] bg-black/50">
                            <img src={pendingDesign.imageUrl} className="w-full h-full object-contain" alt="Staged" />
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
            </div>
        </div>
    );
}
