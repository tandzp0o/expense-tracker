import { NextFunction, Response } from "express";

/**
 * Admin access is opt-in through the environment.
 *
 * The AI endpoints list every user's email and can spawn training jobs on the
 * server, so an unset allow-list denies everyone rather than quietly letting any
 * signed-in account through — which is what happened before, when merely holding
 * a valid token was enough.
 */
const parseAllowList = (value?: string) =>
    String(value || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

export const isAdminUser = (user?: { uid?: string; email?: string }) => {
    if (!user) {
        return false;
    }

    const allowedUids = parseAllowList(process.env.ADMIN_UIDS);
    const allowedEmails = parseAllowList(process.env.ADMIN_EMAILS).map((entry) =>
        entry.toLowerCase(),
    );

    if (!allowedUids.length && !allowedEmails.length) {
        return false;
    }

    // A Firebase uid is case-sensitive and must match exactly; an email address
    // is not, so it is compared in lower case.
    return (
        (!!user.uid && allowedUids.includes(user.uid)) ||
        (!!user.email && allowedEmails.includes(user.email.toLowerCase()))
    );
};

export const attachAdminFlag = (
    req: any,
    _res: Response,
    next: NextFunction,
) => {
    req.isAdmin = isAdminUser(req.user);
    next();
};

export const requireAdmin = (req: any, res: Response, next: NextFunction) => {
    if (isAdminUser(req.user)) {
        return next();
    }

    return res.status(403).json({
        success: false,
        message:
            "Chức năng này chỉ dành cho quản trị viên. Đặt ADMIN_UIDS hoặc ADMIN_EMAILS trên máy chủ để cấp quyền.",
    });
};
