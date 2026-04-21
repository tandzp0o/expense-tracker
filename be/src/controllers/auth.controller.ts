import { Request, Response } from "express";
import User from "../models/User";
import {
    USERNAME_RULE_TEXT,
    deriveDisplayName,
    isUsernameValid,
    mergeAuthProviders,
    normalizeUsername,
    syncUserIdentity,
} from "../utils/user-identity";

interface AuthenticatedRequest extends Request {
    user?: {
        uid: string;
        email: string;
        name?: string;
        picture?: string;
        signInProvider?: string;
    };
}

export const verifyToken = async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!req.user) {
            console.log("Không tìm thấy user trong request");
            return res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
        }

        const { uid, email, picture, name, signInProvider } = req.user;
        console.log("Xác thực user:", { uid, email });

        const user = await syncUserIdentity({
            uid,
            email,
            displayName: name,
            picture,
            signInProvider,
        });

        res.set("Cache-Control", "private, no-store, max-age=0");
        res.status(200).json({
            success: true,
            uid: user.uid,
            email: user.email,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar || picture || "",
            photoURL: picture || "",
            createdAt: user.createdAt,
            newUser: user.newUser,
            hasPassword: user.hasPassword,
            authProviders: user.authProviders,
        });
    } catch (error) {
        console.error("Lỗi khi xác thực token:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
};

export const resolveLoginIdentifier = async (req: Request, res: Response) => {
    try {
        const identifier = String(req.body?.identifier || "").trim();

        if (!identifier) {
            return res.status(400).json({
                success: false,
                message: "Identifier is required",
            });
        }

        if (identifier.includes("@")) {
            const normalizedEmail = identifier.toLowerCase();
            const user = await User.findOne({ email: normalizedEmail }).select(
                "email hasPassword authProviders",
            );

            return res.status(200).json({
                success: true,
                email: normalizedEmail,
                hasPassword: user?.hasPassword ?? true,
                authProviders: user?.authProviders || [],
            });
        }

        const username = normalizeUsername(identifier);
        if (!isUsernameValid(username)) {
            return res.status(400).json({
                success: false,
                message: USERNAME_RULE_TEXT,
            });
        }

        const user = await User.findOne({ username }).select(
            "email hasPassword authProviders",
        );
        if (!user?.email) {
            return res.status(404).json({
                success: false,
                message: "Account not found",
            });
        }

        return res.status(200).json({
            success: true,
            email: user.email,
            hasPassword: user.hasPassword,
            authProviders: user.authProviders || [],
        });
    } catch (error) {
        console.error("Resolve login identifier failed:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
};

export const completeRegistration = async (
    req: AuthenticatedRequest,
    res: Response,
) => {
    try {
        if (!req.user?.uid || !req.user.email) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
        }

        const requestedUsername = normalizeUsername(String(req.body?.username || ""));
        if (!isUsernameValid(requestedUsername)) {
            return res.status(400).json({
                success: false,
                message: USERNAME_RULE_TEXT,
            });
        }

        const duplicate = await User.findOne({
            username: requestedUsername,
            uid: { $ne: req.user.uid },
        }).select("uid");

        if (duplicate) {
            return res.status(409).json({
                success: false,
                message: "Username is already in use",
            });
        }

        const user = await syncUserIdentity({
            uid: req.user.uid,
            email: req.user.email,
            displayName: req.body?.displayName,
            picture: req.user.picture,
            signInProvider: req.user.signInProvider,
            username: requestedUsername,
        });

        user.username = requestedUsername;
        user.displayName =
            String(req.body?.displayName || "").trim() ||
            user.displayName ||
            deriveDisplayName(user.email, req.user.name);
        user.hasPassword = true;
        user.authProviders = mergeAuthProviders(
            user.authProviders || [],
            "password",
        );

        await user.save();

        return res.status(200).json({
            success: true,
            uid: user.uid,
            email: user.email,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar || "",
            newUser: user.newUser,
            hasPassword: user.hasPassword,
            authProviders: user.authProviders,
        });
    } catch (error) {
        console.error("Complete registration failed:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
        });
    }
};
