"use client";

import { useMemo } from "react";

import { useAssistantUsage } from "@/lib/chat/use-assistant-usage";

function formatLastActive(timestamp: number | null): string {
    if (!timestamp) {
        return "No assistant activity yet";
    }
    return new Date(timestamp).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

export function AssistantUsagePanel() {
    const { usage, status, error } = useAssistantUsage();

    const avgMessagesPerSession = useMemo(() => {
        if (!usage.sessionsUsed) {
            return 0;
        }
        return Math.round((usage.totalMessages / usage.sessionsUsed) * 10) / 10;
    }, [usage.sessionsUsed, usage.totalMessages]);

    return (
        <div className="settings-double-grid">
            <article className="settings-info-card surface-card">
                <p className="dash-eyebrow">Usage</p>
                <h3>Saved assistant activity</h3>
                <p>
                    This section is now wired to stored chat data instead of placeholder copy, so people can
                    see how often the assistant is actually part of their workflow.
                </p>

                {error ? <p className="settings-notice settings-notice--error">{error}</p> : null}

                <dl className="settings-usage-grid">
                    <div>
                        <dt>Prompts</dt>
                        <dd>{status === "loading" ? "-" : usage.userPrompts}</dd>
                    </div>
                    <div>
                        <dt>Replies</dt>
                        <dd>{status === "loading" ? "-" : usage.assistantReplies}</dd>
                    </div>
                    <div>
                        <dt>Sessions used</dt>
                        <dd>{status === "loading" ? "-" : usage.sessionsUsed}</dd>
                    </div>
                    <div>
                        <dt>Total messages</dt>
                        <dd>{status === "loading" ? "-" : usage.totalMessages}</dd>
                    </div>
                </dl>
            </article>


        </div>
    );
}