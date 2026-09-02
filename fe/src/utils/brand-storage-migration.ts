/**
 * The app was renamed from FinTrack to TonFin, and every localStorage key moved
 * with it (`fintrack-language` -> `tonfin-language`, and so on). Renaming alone
 * would silently reset anyone who already used the app: their language, theme,
 * currency and "I already saw this guide" flags all live under the old prefix.
 *
 * So on boot we copy anything still on the old prefix across, once. Existing
 * values under the new prefix always win, because those are more recent.
 */
const OLD_PREFIX = "fintrack-";
const NEW_PREFIX = "tonfin-";
const MIGRATION_FLAG = "tonfin-brand-migrated";

export const migrateLegacyBrandStorage = () => {
    if (typeof window === "undefined") {
        return;
    }

    try {
        if (window.localStorage.getItem(MIGRATION_FLAG)) {
            return;
        }

        const legacyKeys = Object.keys(window.localStorage).filter((key) =>
            key.startsWith(OLD_PREFIX),
        );

        legacyKeys.forEach((legacyKey) => {
            const nextKey = `${NEW_PREFIX}${legacyKey.slice(OLD_PREFIX.length)}`;
            const value = window.localStorage.getItem(legacyKey);

            if (value !== null && window.localStorage.getItem(nextKey) === null) {
                window.localStorage.setItem(nextKey, value);
            }

            window.localStorage.removeItem(legacyKey);
        });

        window.localStorage.setItem(MIGRATION_FLAG, "1");
    } catch {
        // Private mode or a blocked storage API: not worth breaking boot over.
    }
};
