import { useRef, useEffect, useState } from "react";
import { Send, Image as ImageIcon, Lock, Download, Paperclip, Mic, Square, X, FileText } from "lucide-react";
import { Message, Attachment } from "@/types";
import { cn } from "@/lib/utils";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

interface ChatInterfaceProps {
    messages: Message[];
    onSendMessage: (text: string, attachments: Attachment[], audioUrl?: string) => void;
    isReadOnly?: boolean;
    onExit?: () => void;
}

export function ChatInterface({ messages, onSendMessage, isReadOnly = false, onExit }: ChatInterfaceProps) {
    const [inputText, setInputText] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Attachments
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [tempAttachments, setTempAttachments] = useState<Attachment[]>([]);

    // Voice Recording State
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = () => {
        if (!inputText.trim() && tempAttachments.length === 0) return;
        onSendMessage(inputText, tempAttachments);
        setInputText("");
        setTempAttachments([]); // Clear attachments after send
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // --- Attachments Logic ---
    const handlePaperclipClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            // Convert to Base64 for Mock/Local usage
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64Info = reader.result as string;
                // Determine type
                const type = file.type.startsWith('image/') ? 'image' : 'file';

                setTempAttachments(prev => [...prev, {
                    type,
                    url: base64Info, // In a real app, upload first like Audio, but Base64 is fine for text-based JSON storage
                    name: file.name
                }]);
            };
            reader.readAsDataURL(file);
        }
    };

    // --- Voice Logic (Same as before) ---
    const startRecording = async () => {
        try {
            if (typeof window === 'undefined') return; // Safety
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    setAudioChunks((prev) => [...prev, e.data]);
                }
            };

            recorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                // Simplified Logic: Convert Audio to Base64 for LocalStorage stability!
                // Firebase Storage might fail without keys, breaking the "Mock" promise.
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    const base64 = reader.result as string;
                    onSendMessage("Voice Note 🎤", [], base64);
                    setAudioChunks([]);
                }
            };

            recorder.start();
            setIsRecording(true);
        } catch (err: any) {
            console.error("Error accessing microphone:", err);
            // Fallback alert
            alert("Microphone access denied or not available (Ensure HTTPS or Localhost).");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    return (
        <div className="flex flex-col h-full bg-black relative">

            {/* Mobile/Client Header with Exit Button */}
            <div className="absolute top-4 right-4 z-50">
                {onExit && (
                    <button
                        onClick={onExit}
                        className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/50 transition-all"
                        title="Exit Chat"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pt-12">

                {/* Warning if no messages (should be covered by Self-Healing logic now, but just in case) */}
                {/* REMOVED blocking loader. If empty, just show empty or let main layout handle injection */}            {messages.map((message) => (
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
                            {/* Actual Audio Render */}
                            {message.audioUrl && (
                                <div className="mb-2 min-w-[200px]">
                                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                                    <audio controls src={message.audioUrl} className="w-full h-8" />
                                </div>
                            )}

                            {/* Attachments Render */}
                            {message.attachments && message.attachments.length > 0 && (
                                <div className="mb-2 flex flex-wrap gap-2">
                                    {message.attachments.map((att, idx) => (
                                        att.type === 'image' ? (
                                            <img key={idx} src={att.url} alt="attachment" className="w-32 h-32 object-cover rounded-lg border border-black/10" />
                                        ) : (
                                            <div key={idx} className="flex items-center gap-2 bg-black/10 p-2 rounded text-xs">
                                                <FileText className="w-4 h-4" /> {att.name || "File"}
                                            </div>
                                        )
                                    ))}
                                </div>
                            )}

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
                                {message.role === 'user' ? 'Client' : 'DesignHaus'}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            {
                !isReadOnly && (
                    <div className="p-4 md:p-6 bg-black border-t border-white/10">
                        {/* Pending Attachments Preview */}
                        {tempAttachments.length > 0 && (
                            <div className="flex gap-2 px-2 pb-2 overflow-x-auto">
                                {tempAttachments.map((att, i) => (
                                    <div key={i} className="relative bg-zinc-800 p-1 rounded">
                                        {att.type === 'image' ? (
                                            <img src={att.url} className="w-10 h-10 object-cover rounded" alt="prev" />
                                        ) : (
                                            <FileText className="w-10 h-10 p-2 text-zinc-400" />
                                        )}
                                        <button onClick={() => setTempAttachments(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 rounded-full w-4 h-4 flex items-center justify-center text-[10px]">×</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="max-w-4xl mx-auto flex items-end gap-3 bg-zinc-900/50 p-2 rounded-2xl border border-white/5 focus-within:border-[var(--accent-yellow)]/50 transition-colors">

                            {/* Attachments Input */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                className="hidden"
                                multiple // Allow multiple files selection
                            />
                            <button
                                onClick={handlePaperclipClick}
                                className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
                            >
                                <Paperclip className="w-5 h-5" />
                            </button>

                            {/* Audio Input */}
                            <button
                                onClick={isRecording ? stopRecording : startRecording}
                                className={cn(
                                    "p-3 rounded-xl transition-all duration-300",
                                    isRecording ? "bg-red-500/20 text-red-500 animate-pulse" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                                )}
                            >
                                {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
                            </button>

                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={isRecording ? "Listening..." : "Describe your packaging concept..."}
                                className="flex-1 bg-transparent border-none text-white placeholder-zinc-600 focus:ring-0 resize-none py-3 max-h-32 text-sm md:text-base"
                                rows={1}
                            />

                            <button
                                onClick={handleSend}
                                disabled={!inputText.trim() && !isRecording && tempAttachments.length === 0}
                                className="p-3 bg-[var(--accent-yellow)] text-black rounded-xl hover:bg-white disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-600 transition-all"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-center text-[10px] text-zinc-600 mt-3 uppercase tracking-widest">
                            DesignHaus Concept Generation. Professional Review Required.
                        </p>
                    </div>
                )
            }
        </div>
    );
}
