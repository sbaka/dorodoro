import { off, onValue, ref } from "firebase/database";

import { getFirebaseDatabase } from "@/lib/firebase/database";

export type AssistantUsage = {
    sessionsUsed: number;
    userPrompts: number;
    assistantReplies: number;
    totalMessages: number;
    lastActiveAt: number | null;
};

export const EMPTY_ASSISTANT_USAGE: AssistantUsage = {
    sessionsUsed: 0,
    userPrompts: 0,
    assistantReplies: 0,
    totalMessages: 0,
    lastActiveAt: null,
};

function sessionsPath(uid: string): string {
    return `users/${uid}/sessions`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function countMessages(
    messages: Record<string, unknown>,
    acc: { userPrompts: number; assistantReplies: number; totalMessages: number; lastActiveAt: number | null },
): void {
    for (const message of Object.values(messages)) {
        if (!isRecord(message)) continue;
        const role = typeof message.role === "string" ? message.role : "";
        const createdAt = Number(message.createdAt) || 0;
        acc.totalMessages += 1;
        if (role === "user") acc.userPrompts += 1;
        if (role === "assistant") acc.assistantReplies += 1;
        if (createdAt > 0 && (acc.lastActiveAt === null || createdAt > acc.lastActiveAt)) {
            acc.lastActiveAt = createdAt;
        }
    }
}

export function summarizeAssistantUsage(raw: unknown): AssistantUsage {
    if (!isRecord(raw)) {
        return { ...EMPTY_ASSISTANT_USAGE };
    }

    let sessionsUsed = 0;
    const acc = { userPrompts: 0, assistantReplies: 0, totalMessages: 0, lastActiveAt: null as number | null };

    for (const session of Object.values(raw)) {
        if (!isRecord(session)) continue;

        const aiChat = isRecord(session.aiChat) ? session.aiChat : null;
        const beforeCount = acc.totalMessages;

        // New path: aiChat/chats/*/messages
        const chats = aiChat && isRecord(aiChat.chats) ? aiChat.chats : null;
        if (chats) {
            for (const chat of Object.values(chats)) {
                if (!isRecord(chat)) continue;
                const chatMessages = isRecord(chat.messages) ? chat.messages : null;
                if (chatMessages) {
                    countMessages(chatMessages, acc);
                }
                const chatUpdatedAt = Number(chat.updatedAt) || 0;
                if (chatUpdatedAt > 0 && (acc.lastActiveAt === null || chatUpdatedAt > acc.lastActiveAt)) {
                    acc.lastActiveAt = chatUpdatedAt;
                }
            }
        }

        // Legacy path: aiChat/messages (fallback during migration)
        const legacyMessages = aiChat && isRecord(aiChat.messages) ? aiChat.messages : null;
        if (legacyMessages) {
            countMessages(legacyMessages, acc);
        }

        const updatedAt = Number(aiChat?.updatedAt) || 0;
        if (updatedAt > 0 && (acc.lastActiveAt === null || updatedAt > acc.lastActiveAt)) {
            acc.lastActiveAt = updatedAt;
        }

        if (acc.totalMessages > beforeCount) {
            sessionsUsed += 1;
        }
    }

    return {
        sessionsUsed,
        userPrompts: acc.userPrompts,
        assistantReplies: acc.assistantReplies,
        totalMessages: acc.totalMessages,
        lastActiveAt: acc.lastActiveAt,
    };
}

export function subscribeToAssistantUsage(
    uid: string,
    onData: (usage: AssistantUsage) => void,
    onError: (error: Error) => void,
): () => void {
    const db = getFirebaseDatabase();
    const sessionsRef = ref(db, sessionsPath(uid));
    const unsubscribe = onValue(
        sessionsRef,
        (snap) => {
            onData(summarizeAssistantUsage(snap.val()));
        },
        (err) => onError(err instanceof Error ? err : new Error(String(err))),
    );

    return () => {
        off(sessionsRef);
        unsubscribe();
    };
}
