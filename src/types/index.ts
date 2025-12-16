import { Timestamp } from 'firebase/firestore';

export type Role = 'user' | 'ai' | 'admin';

export interface Attachment {
    type: 'image';
    url: string;
    name?: string;
}

export interface Message {
    id: string; // Firestore Doc ID
    role: Role;
    content: string;
    timestamp: Date | Timestamp; // Allow Firestore Timestamp
    attachments?: Attachment[];

    // Proposal fields
    isProposal?: boolean;
    isLocked?: boolean;
    proposalAmount?: number;
    imageUrl?: string;
    isPaid?: boolean; // Track paid status directly
}

export interface DesignSession {
    id: string;
    clientName: string; // e.g., "Client-123"
    createdAt: Date | Timestamp;
    lastMessage?: string;
    unreadCount?: number;
}
