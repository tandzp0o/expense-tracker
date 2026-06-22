import { Request, Response } from "express";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import User from "../models/User";

const AI_DIR = path.resolve(process.cwd(), "..", "ai-recommender");
const AI_SCRIPT = path.join(AI_DIR, "ai_recommender_all_in_one.py");
const ARTIFACTS_DIR = path.join(AI_DIR, "artifacts");
const AI_SERVICE_URL = process.env.AI_SERVICE_URL?.replace(/\/$/, "");
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY;
const PYTHON_COMMAND = process.env.PYTHON_COMMAND || "python";

let isTraining = false;
let lastTrainAt: string | null = null;
let lastTrainError: string | null = null;

const isRemoteAiEnabled = () => Boolean(AI_SERVICE_URL);

const callAiService = async <T>(
    endpoint: string,
    init: RequestInit = {},
): Promise<T> => {
    if (!AI_SERVICE_URL) {
        throw new Error("AI_SERVICE_URL is not configured");
    }

    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (AI_SERVICE_KEY) {
        headers.set("x-ai-service-key", AI_SERVICE_KEY);
    }

    const response = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
        ...init,
        headers,
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) {
        throw new Error(payload?.detail || payload?.message || text || "AI service request failed");
    }

    return payload as T;
};

const runPythonCommand = (
    args: string[],
): Promise<{ stdout: string; stderr: string; code: number }> =>
    new Promise((resolve, reject) => {
        const child = spawn(PYTHON_COMMAND, args, {
            cwd: AI_DIR,
            env: process.env,
            shell: false,
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk) => {
            stdout += String(chunk);
        });
        child.stderr.on("data", (chunk) => {
            stderr += String(chunk);
        });
        child.on("error", (error) => reject(error));
        child.on("close", (code) => {
            resolve({ stdout, stderr, code: code ?? 1 });
        });
    });

const readJsonIfExists = (filePath: string) => {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
        return null;
    }
};

export const getAiStatus = async (_req: Request, res: Response) => {
    if (isRemoteAiEnabled()) {
        try {
            const status = await callAiService<Record<string, unknown>>("/status", { method: "GET" });
            return res.json({
                success: true,
                data: {
                    mode: "remote-service",
                    serviceUrl: AI_SERVICE_URL,
                    ...status,
                },
            });
        } catch (error: any) {
            return res.status(502).json({
                success: false,
                message: "AI service status failed",
                error: error?.message || "Unknown AI service error",
            });
        }
    }

    const clusterReportPath = path.join(ARTIFACTS_DIR, "cluster_report.json");
    const monthlyPath = path.join(ARTIFACTS_DIR, "monthly_features.csv");
    const hasMonthly = fs.existsSync(monthlyPath);
    const clusterReport = readJsonIfExists(clusterReportPath);

    return res.json({
        success: true,
        data: {
            mode: "local-script",
            isTraining,
            lastTrainAt,
            lastTrainError,
            hasArtifacts: hasMonthly || Boolean(clusterReport),
            clusterReport,
        },
    });
};

export const trainAiModel = async (_req: Request, res: Response) => {
    if (isRemoteAiEnabled()) {
        try {
            const result = await callAiService("/train", {
                method: "POST",
                body: JSON.stringify({ export_viz: true }),
            });
            return res.json({
                success: true,
                message: "Train completed",
                data: result,
            });
        } catch (error: any) {
            return res.status(502).json({
                success: false,
                message: "AI service train failed",
                error: error?.message || "Unknown AI service error",
            });
        }
    }

    if (isTraining) {
        return res.status(409).json({
            success: false,
            message: "AI model is already training",
        });
    }

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        return res.status(500).json({
            success: false,
            message: "MONGO_URI is missing in server environment",
        });
    }

    if (!fs.existsSync(AI_SCRIPT)) {
        return res.status(500).json({
            success: false,
            message: `AI script not found at ${AI_SCRIPT}`,
        });
    }

    isTraining = true;
    lastTrainError = null;
    try {
        const result = await runPythonCommand([
            "ai_recommender_all_in_one.py",
            "train",
            "--mongo-uri",
            mongoUri,
            "--export-viz",
        ]);

        if (result.code !== 0) {
            lastTrainError = result.stderr || result.stdout || "Unknown train error";
            return res.status(500).json({
                success: false,
                message: "Train failed",
                error: lastTrainError,
            });
        }

        lastTrainAt = new Date().toISOString();
        return res.json({
            success: true,
            message: "Train completed",
            stdout: result.stdout.trim(),
        });
    } catch (error: any) {
        lastTrainError = error?.message || "Unknown error";
        return res.status(500).json({
            success: false,
            message: "Train failed",
            error: lastTrainError,
        });
    } finally {
        isTraining = false;
    }
};

export const listAiUsers = async (_req: Request, res: Response) => {
    const users = await User.find(
        {},
        { _id: 0, uid: 1, email: 1, displayName: 1, totalIncome: 1, totalExpense: 1 },
    ).sort({ updatedAt: -1 });

    return res.json({
        success: true,
        data: users,
    });
};

export const runAiRecommendation = async (req: Request, res: Response) => {
    const userId = String(req.body?.userId || "").trim();
    if (!userId) {
        return res.status(400).json({
            success: false,
            message: "userId is required",
        });
    }

    if (isRemoteAiEnabled()) {
        try {
            const result = await callAiService("/recommend", {
                method: "POST",
                body: JSON.stringify({ user_id: userId }),
            });
            return res.json({
                success: true,
                data: result,
            });
        } catch (error: any) {
            return res.status(502).json({
                success: false,
                message: "AI service recommend failed",
                error: error?.message || "Unknown AI service error",
            });
        }
    }

    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        return res.status(500).json({
            success: false,
            message: "MONGO_URI is missing in server environment",
        });
    }

    const result = await runPythonCommand([
        "ai_recommender_all_in_one.py",
        "recommend",
        "--mongo-uri",
        mongoUri,
        "--user-id",
        userId,
    ]);

    if (result.code !== 0) {
        return res.status(500).json({
            success: false,
            message: "Recommend failed",
            error: result.stderr || result.stdout,
        });
    }

    const outputPath = path.join(ARTIFACTS_DIR, `recommendation_${userId}.json`);
    const recommendation = readJsonIfExists(outputPath);

    return res.json({
        success: true,
        data: {
            outputPath,
            recommendation,
            stdout: result.stdout.trim(),
        },
    });
};
