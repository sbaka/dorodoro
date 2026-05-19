import "server-only";

import { getAdminAuth, getAdminDatabase } from "@/lib/firebase/admin";

export async function exportAccountData(uid: string) {
    const auth = getAdminAuth();
    const db = getAdminDatabase();

    const [userRecord, snapshot] = await Promise.all([
        auth.getUser(uid),
        db.ref(`users/${uid}`).get(),
    ]);

    return {
        exportedAt: new Date().toISOString(),
        account: {
            uid: userRecord.uid,
            email: userRecord.email ?? null,
            displayName: userRecord.displayName ?? null,
            emailVerified: userRecord.emailVerified,
            providers: userRecord.providerData.map((provider) => provider.providerId),
            metadata: {
                createdAt: userRecord.metadata.creationTime ?? null,
                lastSignedInAt: userRecord.metadata.lastSignInTime ?? null,
            },
        },
        data: snapshot.val() ?? {},
    };
}

export async function deleteAccountData(uid: string) {
    const auth = getAdminAuth();
    const db = getAdminDatabase();

    await db.ref(`users/${uid}`).remove();
    await auth.deleteUser(uid);
}