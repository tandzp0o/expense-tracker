import { Request, Response } from "express";
import User from "../models/User";

interface AuthenticatedRequest extends Request {
    user?: {
        uid: string;
        email: string;
        name?: string;
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

        const { uid, email } = req.user;
        console.log("Xác thực user:", { uid, email });

        // Tìm hoặc tạo user mới
        let user = await User.findOne({ uid });

        if (!user) {
            const displayName = email ? email.split("@")[0] : "User";
            console.log("Tạo user mới với displayName:", displayName);

            user = await User.create({
                uid,
                email: email || "",
                displayName,
                createdAt: new Date(),
            });
        }

        res.status(200).json({
            success: true,
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            createdAt: user.createdAt,
            newUser: user.newUser,
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
