import "server-only";

import { getAdminAuth } from "@/lib/firebase/admin";

export class RequestAuthError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
    }
}

export async function verifyRequestUser(request: Request) {
    const authHeader = request.headers.get("authorization") ?? "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);

    if (!match) {
        throw new RequestAuthError("Missing account token.", 401);
    }

    try {
        return await getAdminAuth().verifyIdToken(match[1]!);
    } catch {
        throw new RequestAuthError("Invalid or expired account token.", 401);
    }
}