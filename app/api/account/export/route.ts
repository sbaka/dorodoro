import { NextResponse } from "next/server";

import { exportAccountData } from "@/lib/account/account-data";
import { RequestAuthError, verifyRequestUser } from "@/lib/auth/server-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const decoded = await verifyRequestUser(request);
        const payload = await exportAccountData(decoded.uid);
        return NextResponse.json(payload);
    } catch (error) {
        if (error instanceof RequestAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[account-export] failed", error);
        return NextResponse.json(
            { error: "Could not export account data right now. Try again." },
            { status: 500 },
        );
    }
}