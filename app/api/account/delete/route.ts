import { NextResponse } from "next/server";

import { deleteAccountData } from "@/lib/account/account-data";
import { RequestAuthError, verifyRequestUser } from "@/lib/auth/server-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if ((body as { confirm?: unknown })?.confirm !== "DELETE") {
        return NextResponse.json(
            { error: "Deletion confirmation is required." },
            { status: 400 },
        );
    }

    try {
        const decoded = await verifyRequestUser(request);
        await deleteAccountData(decoded.uid);
        return NextResponse.json({ ok: true });
    } catch (error) {
        if (error instanceof RequestAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[account-delete] failed", error);
        return NextResponse.json(
            { error: "Could not delete the account right now. Try again." },
            { status: 500 },
        );
    }
}