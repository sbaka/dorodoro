"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/app/components/auth-provider";
import {
    EMPTY_ASSISTANT_USAGE,
    subscribeToAssistantUsage,
    type AssistantUsage,
} from "@/lib/chat/usage";

export type UseAssistantUsageResult = {
    usage: AssistantUsage;
    status: "loading" | "ready" | "error";
    error: string | null;
};

export function useAssistantUsage(): UseAssistantUsageResult {
    const { user, status: authStatus } = useAuth();
    const [usage, setUsage] = useState<AssistantUsage>({ ...EMPTY_ASSISTANT_USAGE });
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (authStatus === "loading") {
            return;
        }

        if (!user) {
            setUsage({ ...EMPTY_ASSISTANT_USAGE });
            setStatus("ready");
            setError(null);
            return;
        }

        setStatus("loading");
        setError(null);

        return subscribeToAssistantUsage(
            user.uid,
            (next) => {
                setUsage(next);
                setStatus("ready");
            },
            (err) => {
                console.error("Failed to load assistant usage:", err);
                setUsage({ ...EMPTY_ASSISTANT_USAGE });
                setStatus("error");
                setError("Could not load assistant activity.");
            },
        );
    }, [authStatus, user]);

    return { usage, status, error };
}