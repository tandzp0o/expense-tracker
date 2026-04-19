import { createHash } from "crypto";
import { ClientSession } from "mongoose";
import User from "../models/User";

interface TransactionCacheActor {
    email?: string;
    name?: string;
}

interface TransactionCacheState {
    version: number;
    updatedAt: Date | null;
}

const fallbackEmailForUser = (userId: string) => `${userId}@local.invalid`;

const getDisplayName = (userId: string, actor?: TransactionCacheActor) => {
    const email = actor?.email?.trim() || fallbackEmailForUser(userId);
    return actor?.name?.trim() || email.split("@")[0] || "User";
};

export const touchTransactionCacheState = async (
    userId: string,
    actor?: TransactionCacheActor,
    session?: ClientSession,
) => {
    const now = new Date();

    await User.updateOne(
        { uid: userId },
        {
            $inc: { transactionCacheVersion: 1 },
            $set: { transactionsUpdatedAt: now },
            $setOnInsert: {
                email: actor?.email?.trim() || fallbackEmailForUser(userId),
                displayName: getDisplayName(userId, actor),
                newUser: false,
            },
        },
        {
            upsert: true,
            ...(session ? { session } : {}),
        },
    );

    return now;
};

export const getTransactionCacheState = async (
    userId: string,
): Promise<TransactionCacheState> => {
    const user = await User.findOne({ uid: userId })
        .select("transactionCacheVersion transactionsUpdatedAt")
        .lean();

    return {
        version: user?.transactionCacheVersion ?? 0,
        updatedAt: user?.transactionsUpdatedAt ?? null,
    };
};

export const buildTransactionCacheTag = (
    version: number,
    queryKey: string,
) => {
    const digest = createHash("sha1").update(queryKey).digest("hex");
    return `W/"transactions-${version}-${digest}"`;
};
