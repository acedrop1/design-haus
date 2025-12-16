import { useRef, useEffect, useState } from "react";
import { Send, Image as ImageIcon, Lock, Download, Paperclip } from "lucide-react";
import { Message, Attachment } from "@/types";
import { cn } from "@/lib/utils";

interface ChatInterfaceProps {
    messages: Message[];
    onSendMessage: (text: string, attachments: Attachment[]) => void;
    isReadOnly?: boolean;
}

export function ChatInterface({ messages, onSendMessage, isReadOnly = false }: ChatInterfaceProps) {
    const [inputText, setInputText] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = () => {
        if (!inputText.trim()) return;
        onSendMessage(inputText, []);
        setInputText("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (ts: any) => {
        if (!ts) return "";
        // Handle Firestore Timestamp or standard Date
        const date = ts?.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex flex-col h-full bg-black/50 backdrop-blur-xl relative">
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={cn(
                            "flex w-full",
                            message.role === 'user' ? "justify-end" : "justify-start"
                        )}
                    >
                        <div
                            className={cn(
                                "max-w-[80vw] md:max-w-2xl p-4 md:p-6 rounded-2xl relative",
                                message.role === 'user'
                                    ? "bg-white text-black rounded-tr-sm"
                                    : "bg-zinc-900 border border-zinc-800 text-gray-200 rounded-tl-sm"
                            )}
                        >
                            {message.content && <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>}

                            {/* Proposal / Design Logic */}
                            {message.imageUrl && (
                                <div className="mt-4 relative group overflow-hidden rounded-lg border border-zinc-800">
                                    {message.isLocked ? (
                                        <>
                                            <div className="relative aspect-[4/5] w-64 md:w-80 overflow-hidden">
                                                <img
                                                    src={message.imageUrl}
                                                    alt="Design Preview"
                                                    className="w-full h-full object-cover blur-xl scale-110 transition-transform duration-700"
                                                />
                                                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-6 text-center z-10">
                                                    <Lock className="w-8 h-8 text-[var(--accent-yellow)] mb-3" />
                                                    <h3 className="text-white font-bold text-lg uppercase tracking-widest mb-1">Locked Design</h3>
                                                    <p className="text-xs text-gray-400 mb-4">Watermarked concept preview</p>
                                                    <a
                                                        href="https://buy.stripe.com/test_8x25kC54w8TBbJkaEq2ZO00"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="bg-[var(--accent-yellow)] hover:bg-white text-black font-bold py-2 px-6 rounded-full text-xs uppercase tracking-wider transition-colors"
                                                    >
                                                        Unlock for ${message.proposalAmount || 25}
                                                    </a>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="relative aspect-[4/5] w-64 md:w-80">
                                            <img
                                                src={message.imageUrl}
                                                alt="Final Design"
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="flex items-center gap-2 text-white bg-white/20 hover:bg-white/30 backdrop-blur-md px-4 py-2 rounded-lg text-sm font-medium w-full justify-center transition-colors">
                                                    <Download className="w-4 h-4" /> Download High-Res
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-2 text-right">
                                {message.role === 'user' ? 'Client' : 'DesignHaus AI'} • {formatTime(message.timestamp)}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            {!isReadOnly && (
                <div className="p-4 md:p-6 bg-black border-t border-white/10">
                    <div className="max-w-4xl mx-auto flex items-end gap-3 bg-zinc-900/50 p-2 rounded-2xl border border-white/5 focus-within:border-[var(--accent-yellow)]/50 transition-colors">
                        <button className="p-3 text-zinc-400 hover:text-white transition-colors">
                            <Paperclip className="w-5 h-5" />
                        </button>
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Describe your packaging concept..."
                            className="flex-1 bg-transparent border-none text-white placeholder-zinc-500 focus:ring-0 resize-none py-3 max-h-32"
                            rows={1}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!inputText.trim()}
                            className="p-3 bg-[var(--accent-yellow)] text-black rounded-xl hover:bg-white disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-600 transition-all"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-center text-[10px] text-zinc-600 mt-3 uppercase tracking-widest">
                        AI-Generated Concepts. Professional Review Required.
                    </p>
                </div>
            )}
        </div>
    );
}
