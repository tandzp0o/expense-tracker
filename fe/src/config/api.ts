const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, "");

const isLocalHostname = () => {
    if (typeof window === "undefined") {
        return process.env.NODE_ENV !== "production";
    }

    return ["localhost", "127.0.0.1"].includes(window.location.hostname);
};

export const resolveApiUrl = () => {
    const localUrl = process.env.REACT_APP_API_URL_LOCAL?.trim();
    const deployedUrl = process.env.REACT_APP_API_URL?.trim();
    const fallbackUrl = "http://localhost:1810";

    const selectedUrl = isLocalHostname()
        ? localUrl || deployedUrl || fallbackUrl
        : deployedUrl || localUrl || fallbackUrl;

    return trimTrailingSlashes(selectedUrl);
};

export const API_URL = resolveApiUrl();
