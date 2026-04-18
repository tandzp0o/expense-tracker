import * as admin from "firebase-admin";
import * as dotenv from "dotenv";

dotenv.config();

const resolvePrivateKey = () => {
    const part1 = process.env.FIREBASE_PRIVATE_KEY_1 || "";
    const part2 = process.env.FIREBASE_PRIVATE_KEY_2 || "";
    const part3 = process.env.FIREBASE_PRIVATE_KEY_3 || "";
    const combinedParts = `${part1}${part2}${part3}`.trim();

    if (combinedParts) {
        return Buffer.from(combinedParts, "base64").toString("utf8");
    }

    const fallbackKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
    if (!fallbackKey) {
        return "";
    }

    if (fallbackKey.includes("BEGIN PRIVATE KEY")) {
        return fallbackKey.replace(/\\n/g, "\n");
    }

    return Buffer.from(fallbackKey, "base64").toString("utf8");
};

if (!admin.apps.length) {
    try {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = resolvePrivateKey();

        if (!projectId || !clientEmail || !privateKey) {
            throw new Error("Thieu cau hinh Firebase");
        }

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });

        console.log("Firebase Admin da duoc khoi tao thanh cong");
    } catch (error: any) {
        console.error("Loi khoi tao Firebase Admin:", error.message);
    }
}

export default admin;
