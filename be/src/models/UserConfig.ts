import mongoose, { Document, Schema } from "mongoose";

export interface IDeviceToken {
    token: string;
    platform?: string;
    updatedAt: Date;
}

export interface IUserConfig extends Document {
    userId: string;
    /** Master switch: false silences every reminder without losing the times. */
    remindersEnabled: boolean;
    /** Times of day in "HH:mm", aligned to 30 minute slots, user local time. */
    reminderTimes: string[];
    /** IANA timezone the reminder times are expressed in. */
    timezone: string;
    /** Skip the nudge when the user already recorded something that day. */
    skipWhenAlreadyLogged: boolean;
    deviceTokens: IDeviceToken[];
    /**
     * Last delivered slot key, "YYYY-MM-DD HH:mm" in the user's timezone. Makes
     * dispatch idempotent when the cron fires twice for the same window.
     */
    lastSentSlot?: string;
    lastSentAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const DeviceTokenSchema = new Schema<IDeviceToken>(
    {
        token: { type: String, required: true },
        platform: { type: String },
        updatedAt: { type: Date, default: Date.now },
    },
    { _id: false },
);

const UserConfigSchema = new Schema<IUserConfig>(
    {
        userId: { type: String, required: true, unique: true, index: true },
        remindersEnabled: { type: Boolean, default: true },
        reminderTimes: { type: [String], default: [] },
        timezone: { type: String, default: "Asia/Ho_Chi_Minh" },
        skipWhenAlreadyLogged: { type: Boolean, default: true },
        deviceTokens: { type: [DeviceTokenSchema], default: [] },
        lastSentSlot: { type: String },
        lastSentAt: { type: Date },
    },
    { timestamps: true },
);

// The dispatcher only ever scans enabled configs that have at least one time.
UserConfigSchema.index({ remindersEnabled: 1, reminderTimes: 1 });

export default mongoose.model<IUserConfig>("UserConfig", UserConfigSchema);
