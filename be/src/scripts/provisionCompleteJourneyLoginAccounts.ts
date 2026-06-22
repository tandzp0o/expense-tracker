import mongoose from "mongoose";
import admin from "../config/firebase";

type MongoDocument = Record<string, any>;
type MongoCollection = mongoose.mongo.Collection<MongoDocument>;

type SeedUser = {
    _id?: unknown;
    uid: string;
    email: string;
    displayName?: string;
    sourceDataset?: string;
    [key: string]: unknown;
};

type ScriptArgs = {
    sourceDb: string;
    targetDb: string;
    password: string;
    batchSize: number;
    concurrency: number;
    limit: number;
    uids: string[];
    skipMongoCopy: boolean;
    skipFirebase: boolean;
};

const DEFAULT_SOURCE_DB = "expense-tracker-complete-journey";
const DEFAULT_TARGET_DB = "expense-tracker";
const DEFAULT_PASSWORD = "123123";
const COMPLETE_JOURNEY_DATASET = "complete-journey";
const COMPLETE_JOURNEY_EMAIL_DOMAIN = "@completejourney.local";

const COLLECTIONS = ["users", "wallets", "goals", "budgets", "transactions"] as const;

const parseArgs = (): ScriptArgs => {
    const args: ScriptArgs = {
        sourceDb: DEFAULT_SOURCE_DB,
        targetDb: DEFAULT_TARGET_DB,
        password: DEFAULT_PASSWORD,
        batchSize: 5_000,
        concurrency: 8,
        limit: 0,
        uids: [],
        skipMongoCopy: false,
        skipFirebase: false,
    };

    const readValue = (items: string[], index: number, flag: string) => {
        const value = items[index + 1];
        if (!value || value.startsWith("--")) {
            throw new Error(`Missing value for ${flag}`);
        }
        return value;
    };

    const items = process.argv.slice(2);
    for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        switch (item) {
            case "--source-db":
                args.sourceDb = readValue(items, index, item);
                index += 1;
                break;
            case "--target-db":
                args.targetDb = readValue(items, index, item);
                index += 1;
                break;
            case "--password":
                args.password = readValue(items, index, item);
                index += 1;
                break;
            case "--batch-size":
                args.batchSize = Number.parseInt(readValue(items, index, item), 10);
                index += 1;
                break;
            case "--concurrency":
                args.concurrency = Number.parseInt(readValue(items, index, item), 10);
                index += 1;
                break;
            case "--limit":
                args.limit = Number.parseInt(readValue(items, index, item), 10);
                index += 1;
                break;
            case "--uid":
                args.uids.push(readValue(items, index, item));
                index += 1;
                break;
            case "--uids":
                args.uids.push(
                    ...readValue(items, index, item)
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                );
                index += 1;
                break;
            case "--skip-mongo-copy":
                args.skipMongoCopy = true;
                break;
            case "--skip-firebase":
                args.skipFirebase = true;
                break;
            default:
                throw new Error(`Unknown argument: ${item}`);
        }
    }

    if (args.password.length < 6) {
        throw new Error("Firebase password must contain at least 6 characters.");
    }
    if (!Number.isFinite(args.batchSize) || args.batchSize < 1) {
        throw new Error("--batch-size must be a positive number.");
    }
    if (!Number.isFinite(args.concurrency) || args.concurrency < 1) {
        throw new Error("--concurrency must be a positive number.");
    }
    if (!Number.isFinite(args.limit) || args.limit < 0) {
        throw new Error("--limit must be zero or a positive number.");
    }

    args.uids = [...new Set(args.uids)];
    return args;
};

const readSeedUsers = async (
    users: MongoCollection,
    args: ScriptArgs,
): Promise<SeedUser[]> => {
    const filter =
        args.uids.length > 0
            ? { uid: { $in: args.uids } }
            : { sourceDataset: COMPLETE_JOURNEY_DATASET };

    let cursor = users
        .find(filter)
        .project({
            uid: 1,
            email: 1,
            displayName: 1,
            sourceDataset: 1,
        })
        .sort({ uid: 1 });

    if (args.limit > 0) {
        cursor = cursor.limit(args.limit);
    }

    const result = (await cursor.toArray()) as SeedUser[];
    if (result.length === 0) {
        throw new Error(
            `No Complete Journey users found in source DB '${args.sourceDb}'.`,
        );
    }

    for (const user of result) {
        if (!user.uid || !user.email) {
            throw new Error(`Seed user is missing uid/email: ${JSON.stringify(user)}`);
        }
        if (!user.email.endsWith(COMPLETE_JOURNEY_EMAIL_DOMAIN)) {
            throw new Error(`Refusing non-Complete Journey email: ${user.email}`);
        }
    }

    return result;
};

const deleteFilterFor = (
    collectionName: (typeof COLLECTIONS)[number],
    selectedUsers: SeedUser[],
) => {
    const uids = selectedUsers.map((user) => user.uid);
    const emails = selectedUsers.map((user) => user.email);

    if (collectionName === "users") {
        return {
            $or: [
                { sourceDataset: COMPLETE_JOURNEY_DATASET },
                { uid: { $in: uids } },
                { email: { $in: emails } },
            ],
        };
    }

    return {
        $or: [
            { sourceDataset: COMPLETE_JOURNEY_DATASET },
            { userId: { $in: uids } },
        ],
    };
};

const sourceFilterFor = (
    collectionName: (typeof COLLECTIONS)[number],
    selectedUsers: SeedUser[],
) => {
    const uids = selectedUsers.map((user) => user.uid);
    return collectionName === "users"
        ? { uid: { $in: uids } }
        : { userId: { $in: uids } };
};

const normalizeCopiedDoc = (
    collectionName: (typeof COLLECTIONS)[number],
    doc: MongoDocument,
): MongoDocument => {
    if (collectionName !== "users") {
        return doc;
    }

    return {
        ...doc,
        hasPassword: true,
        authProviders: ["password"],
        newUser: false,
        updatedAt: new Date(),
    };
};

const copyCollection = async (
    source: MongoCollection,
    target: MongoCollection,
    collectionName: (typeof COLLECTIONS)[number],
    selectedUsers: SeedUser[],
    batchSize: number,
) => {
    const deleteResult = await target.deleteMany(deleteFilterFor(collectionName, selectedUsers));
    const cursor = source.find(sourceFilterFor(collectionName, selectedUsers));

    let inserted = 0;
    let batch: MongoDocument[] = [];

    for await (const rawDoc of cursor) {
        batch.push(normalizeCopiedDoc(collectionName, rawDoc));
        if (batch.length >= batchSize) {
            await target.insertMany(batch, { ordered: false });
            inserted += batch.length;
            batch = [];
        }
    }

    if (batch.length > 0) {
        await target.insertMany(batch, { ordered: false });
        inserted += batch.length;
    }

    return {
        deleted: deleteResult.deletedCount,
        inserted,
    };
};

const ensureTargetIndexes = async (targetDb: mongoose.mongo.Db) => {
    await Promise.all([
        targetDb.collection("users").createIndex({ uid: 1 }, { unique: true }),
        targetDb.collection("users").createIndex({ email: 1 }, { unique: true }),
        targetDb.collection("users").createIndex({ username: 1 }, { unique: true, sparse: true }),
        targetDb.collection("wallets").createIndex({ userId: 1 }),
        targetDb.collection("goals").createIndex({ userId: 1 }),
        targetDb.collection("budgets").createIndex(
            { userId: 1, walletId: 1, category: 1, month: 1, year: 1 },
            { unique: true },
        ),
        targetDb.collection("transactions").createIndex({ userId: 1, date: -1, createdAt: -1 }),
        targetDb.collection("transactions").createIndex({ userId: 1, type: 1, date: -1, createdAt: -1 }),
        targetDb.collection("transactions").createIndex({ userId: 1, status: 1, date: -1, createdAt: -1 }),
        targetDb.collection("transactions").createIndex({ userId: 1, category: 1, date: -1, createdAt: -1 }),
    ]);
};

const copyMongoSeed = async (
    sourceDb: mongoose.mongo.Db,
    targetDb: mongoose.mongo.Db,
    selectedUsers: SeedUser[],
    args: ScriptArgs,
) => {
    if (args.sourceDb === args.targetDb) {
        throw new Error("Source DB and target DB must be different for Mongo copy.");
    }

    await ensureTargetIndexes(targetDb);
    const summary: Record<string, { deleted: number; inserted: number }> = {};

    for (const collectionName of COLLECTIONS) {
        console.log(`Copying ${collectionName}...`);
        summary[collectionName] = await copyCollection(
            sourceDb.collection(collectionName),
            targetDb.collection(collectionName),
            collectionName,
            selectedUsers,
            args.batchSize,
        );
        console.log(
            `  ${collectionName}: deleted=${summary[collectionName].deleted}, inserted=${summary[collectionName].inserted}`,
        );
    }

    return summary;
};

const upsertFirebaseUser = async (user: SeedUser, password: string) => {
    const auth = admin.auth();
    const payload = {
        email: user.email,
        password,
        displayName: user.displayName || user.uid,
        emailVerified: true,
        disabled: false,
    };

    try {
        await auth.updateUser(user.uid, payload);
        return "updated";
    } catch (error: any) {
        if (error?.code !== "auth/user-not-found") {
            throw error;
        }
    }

    try {
        const existingByEmail = await auth.getUserByEmail(user.email);
        if (existingByEmail.uid !== user.uid) {
            if (!user.email.endsWith(COMPLETE_JOURNEY_EMAIL_DOMAIN)) {
                throw new Error(`Refusing to delete conflicting Firebase user for ${user.email}`);
            }
            await auth.deleteUser(existingByEmail.uid);
        }
    } catch (error: any) {
        if (error?.code !== "auth/user-not-found") {
            throw error;
        }
    }

    await auth.createUser({
        uid: user.uid,
        ...payload,
    });
    return "created";
};

const runPool = async <T>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<void>,
) => {
    let index = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (index < items.length) {
            const currentIndex = index;
            index += 1;
            await worker(items[currentIndex], currentIndex);
        }
    });

    await Promise.all(workers);
};

const provisionFirebaseUsers = async (
    selectedUsers: SeedUser[],
    args: ScriptArgs,
) => {
    if (!admin.apps.length) {
        throw new Error("Firebase Admin is not initialized. Check be/.env Firebase service account config.");
    }

    const summary = {
        created: 0,
        updated: 0,
        failed: 0,
    };

    await runPool(selectedUsers, args.concurrency, async (user, index) => {
        try {
            const status = await upsertFirebaseUser(user, args.password);
            summary[status] += 1;
            const processed = index + 1;
            if (processed % 50 === 0 || processed === selectedUsers.length) {
                console.log(`  Firebase users processed: ${processed}/${selectedUsers.length}`);
            }
        } catch (error: any) {
            summary.failed += 1;
            console.error(`  Firebase failed for ${user.uid}: ${error?.message || error}`);
        }
    });

    return summary;
};

const main = async () => {
    const args = parseArgs();
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error("Missing MONGO_URI in environment.");
    }

    await mongoose.connect(mongoUri);
    const client = mongoose.connection.getClient();
    const sourceDb = client.db(args.sourceDb);
    const targetDb = client.db(args.targetDb);

    const selectedUsers = await readSeedUsers(sourceDb.collection("users"), args);
    console.log(
        `Selected ${selectedUsers.length} Complete Journey users from '${args.sourceDb}'.`,
    );

    if (!args.skipFirebase && !admin.apps.length) {
        throw new Error("Firebase Admin is not initialized. Check be/.env Firebase service account config.");
    }

    let mongoSummary: Record<string, { deleted: number; inserted: number }> | null = null;
    if (!args.skipMongoCopy) {
        mongoSummary = await copyMongoSeed(sourceDb, targetDb, selectedUsers, args);
    }

    let firebaseSummary: { created: number; updated: number; failed: number } | null = null;
    if (!args.skipFirebase) {
        firebaseSummary = await provisionFirebaseUsers(selectedUsers, args);
    }

    const sample = selectedUsers.slice(0, 5).map((user) => ({
        uid: user.uid,
        email: user.email,
    }));

    console.log(
        JSON.stringify(
            {
                sourceDb: args.sourceDb,
                targetDb: args.targetDb,
                users: selectedUsers.length,
                password: "(hidden)",
                mongo: mongoSummary,
                firebase: firebaseSummary,
                sample,
            },
            null,
            2,
        ),
    );

    await mongoose.disconnect();
};

main().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => undefined);
    process.exitCode = 1;
});
