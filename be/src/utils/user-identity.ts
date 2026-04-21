import { HydratedDocument } from "mongoose";
import User, { IUser, UserAuthProvider } from "../models/User";

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 30;

export const USERNAME_RULE_TEXT =
    "Username must be 3-30 characters and only contain letters, numbers, dot, underscore, or hyphen.";

const collapseRepeatedSeparators = (value: string) =>
    value.replace(/[._-]{2,}/g, (match) => match[0]);

export const normalizeUsername = (value: string) =>
    collapseRepeatedSeparators(
        value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, "")
            .replace(/^[._-]+|[._-]+$/g, ""),
    );

export const isUsernameValid = (value: string) => {
    if (value.length < USERNAME_MIN_LENGTH || value.length > USERNAME_MAX_LENGTH) {
        return false;
    }

    return /^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(value);
};

export const deriveDisplayName = (
    email?: string,
    preferredName?: string,
) => {
    const trimmedName = preferredName?.trim();
    if (trimmedName) {
        return trimmedName;
    }

    const emailPrefix = email?.split("@")[0]?.trim();
    if (emailPrefix) {
        return emailPrefix;
    }

    return "User";
};

const buildUsernameCandidates = (values: Array<string | undefined | null>) => {
    const candidates = values
        .map((value) => normalizeUsername(value || ""))
        .filter(Boolean);

    if (!candidates.length) {
        candidates.push("user");
    }

    return [...new Set(candidates)];
};

export const generateUniqueUsername = async (
    values: Array<string | undefined | null>,
    excludeUid?: string,
) => {
    const candidates = buildUsernameCandidates(values);

    for (const baseCandidate of candidates) {
        const base = baseCandidate.slice(0, USERNAME_MAX_LENGTH);
        if (base.length < USERNAME_MIN_LENGTH) {
            continue;
        }

        const existingUser = await User.findOne({ username: base }).select("uid");
        if (!existingUser || existingUser.uid === excludeUid) {
            return base;
        }

        for (let suffix = 1; suffix <= 9999; suffix += 1) {
            const suffixText = String(suffix);
            const trimmedBase = base.slice(
                0,
                USERNAME_MAX_LENGTH - suffixText.length,
            );
            const candidate = `${trimmedBase}${suffixText}`;

            const duplicate = await User.findOne({ username: candidate }).select("uid");
            if (!duplicate || duplicate.uid === excludeUid) {
                return candidate;
            }
        }
    }

    return `user${Date.now().toString().slice(-6)}`;
};

export const mapSignInProvider = (
    provider?: string | null,
): UserAuthProvider | null => {
    if (!provider) {
        return null;
    }

    if (provider === "google.com") {
        return "google";
    }

    if (provider === "password") {
        return "password";
    }

    return null;
};

export const mergeAuthProviders = (
    currentProviders: UserAuthProvider[] = [],
    provider?: UserAuthProvider | null,
) => {
    if (!provider) {
        return currentProviders;
    }

    return Array.from(new Set([...currentProviders, provider]));
};

type SyncUserInput = {
    uid: string;
    email?: string;
    displayName?: string;
    picture?: string;
    signInProvider?: string | null;
    username?: string | null;
};

export const syncUserIdentity = async ({
    uid,
    email,
    displayName,
    picture,
    signInProvider,
    username,
}: SyncUserInput): Promise<HydratedDocument<IUser>> => {
    const provider = mapSignInProvider(signInProvider);
    const resolvedEmail = (email || "").trim().toLowerCase();
    const resolvedDisplayName = deriveDisplayName(resolvedEmail, displayName);

    let user = await User.findOne({ uid });
    const fallbackUsername = await generateUniqueUsername(
        [username, resolvedDisplayName, resolvedEmail, uid],
        uid,
    );

    if (!user) {
        user = await User.create({
            uid,
            email: resolvedEmail,
            username: fallbackUsername,
            displayName: resolvedDisplayName,
            avatar: picture || "",
            hasPassword: provider === "password",
            authProviders: mergeAuthProviders([], provider),
        });

        return user;
    }

    user.email = resolvedEmail || user.email;
    user.displayName = user.displayName || resolvedDisplayName;
    user.username = user.username || fallbackUsername;
    user.avatar = user.avatar || picture || "";
    user.hasPassword = user.hasPassword || provider === "password";
    user.authProviders = mergeAuthProviders(user.authProviders || [], provider);

    await user.save();
    return user;
};
