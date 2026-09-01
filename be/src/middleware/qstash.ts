import { NextFunction, Request, Response } from "express";
import { Receiver } from "@upstash/qstash";

/**
 * Guards the cron-triggered endpoints. Two mechanisms, in order:
 *
 * 1. QStash signature (`Upstash-Signature`) verified with the signing keys.
 * 2. A shared secret header, so the same endpoint can be driven by any other
 *    cron provider (or curl during development) without QStash.
 *
 * If neither is configured the endpoint refuses every request rather than
 * silently running unauthenticated.
 */
export const verifyCronRequest = async (
    req: Request & { rawBody?: string },
    res: Response,
    next: NextFunction,
) => {
    const sharedSecret = process.env.CRON_SHARED_SECRET?.trim();
    const providedSecret = String(req.headers["x-cron-secret"] || "").trim();

    if (sharedSecret && providedSecret) {
        if (providedSecret === sharedSecret) {
            return next();
        }

        return res.status(401).json({ message: "Invalid cron secret" });
    }

    const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
    const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim();
    const signature = String(req.headers["upstash-signature"] || "").trim();

    if (!currentSigningKey || !nextSigningKey) {
        console.error(
            "Cron endpoint called but neither CRON_SHARED_SECRET nor QStash signing keys are configured",
        );
        return res.status(503).json({ message: "Cron auth not configured" });
    }

    if (!signature) {
        return res.status(401).json({ message: "Missing Upstash-Signature" });
    }

    try {
        const receiver = new Receiver({
            currentSigningKey,
            nextSigningKey,
        });

        const isValid = await receiver.verify({
            signature,
            // Signature covers the exact bytes QStash sent, so the parsed body
            // cannot be used here.
            body: req.rawBody ?? "",
        });

        if (!isValid) {
            return res.status(401).json({ message: "Invalid signature" });
        }

        return next();
    } catch (error) {
        console.error("QStash signature verification failed:", error);
        return res.status(401).json({ message: "Invalid signature" });
    }
};
