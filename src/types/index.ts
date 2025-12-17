import { Timestamp } from 'firebase/firestore';

export type Role = 'user' | 'ai' | 'admin';

export interface Attachment {
    type: 'image' | 'file';
    url: string;
    name?: string;
}

export interface Message {
    id: string;
    role: Role;
    content: string;
    timestamp: Date | Timestamp; // Allow Firestore Timestamp
    attachments?: Attachment[];
    audioUrl?: string; // For Voice Notes

    // Proposal fields
    isProposal?: boolean;
    proposalAmount?: number;
    isLocked?: boolean;
    isPaid?: boolean;
    imageUrl?: string;
}

export interface DesignSession {
    id: string;
    clientName: string;
    createdAt: any;
    started: boolean;
    pendingDesign?: {
        originalPrompt: string;
        imageUrl: string;
        status: 'generated' | 'refined';
    } | null;
}
