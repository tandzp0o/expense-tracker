import { Request, Response, NextFunction } from "express";
import admin from "../config/firebase";

interface AuthenticatedRequest extends Request {
    user?: any;
}

export const verifyFirebaseToken = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token provided" });
    }

    const idToken = authHeader.split(" ")[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email || "",
            name: decodedToken.name || "",
        };
        next();
    } catch (error: any) {
        console.error("Lá»—i xÃ¡c thá»±c token:", error.message);
        if (error.code === "auth/id-token-expired") {
            console.warn("Token Ä‘Ã£ háº¿t háº¡n");
        }
        return res.status(401).json({
            message: "Invalid or expired token",
            error: error.message,
        });
    }
};
