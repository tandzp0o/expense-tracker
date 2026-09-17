/**
 * Đưa các giao dịch cũ về đúng bảng danh mục hiện tại.
 *
 * The transaction form used to store unaccented category names ("An uong") while
 * budgets and reports stored the accented ones ("Ăn uống"), so the same category
 * existed twice and never matched: budgets read 0% while money was going out and
 * charts split one category into two slices. Expenses saved without a budget
 * were also filed under a placeholder category that says nothing about what the
 * money was for.
 *
 *   npx ts-node src/scripts/migrateLegacyCategories.ts            # chỉ xem trước
 *   npx ts-node src/scripts/migrateLegacyCategories.ts --apply    # ghi thay đổi
 */
import mongoose from "mongoose";
import * as dotenv from "dotenv";
import Transaction from "../models/Transaction";

dotenv.config();

const CATEGORY_RENAMES: Record<string, string> = {
    "An uong": "Ăn uống",
    "Di chuyen": "Di chuyển",
    "Mua sam": "Mua sắm",
    "Giai tri": "Giải trí",
    "Suc khoe": "Sức khỏe",
    "Giao duc": "Giáo dục",
    "Hoa don": "Hóa đơn",
    Khac: "Khác",
    // Everything the old form could not classify landed here. "Khác" carries the
    // same meaning and already exists in the shared taxonomy.
    "Chi tieu tu do": "Khác",
};

const run = async () => {
    const apply = process.argv.includes("--apply");
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
        throw new Error("MONGO_URI is missing from the environment");
    }

    await mongoose.connect(mongoUri);
    console.log(apply ? "Chế độ: GHI THAY ĐỔI" : "Chế độ: xem trước (thêm --apply để ghi)");

    let total = 0;

    for (const [legacy, replacement] of Object.entries(CATEGORY_RENAMES)) {
        const matched = await Transaction.countDocuments({ category: legacy });
        if (!matched) {
            continue;
        }

        total += matched;
        console.log(`  ${legacy} -> ${replacement}: ${matched} giao dịch`);

        if (apply) {
            await Transaction.updateMany(
                { category: legacy },
                { $set: { category: replacement } },
            );
        }
    }

    console.log(
        total
            ? `${apply ? "Đã cập nhật" : "Sẽ cập nhật"} ${total} giao dịch.`
            : "Không có giao dịch nào dùng danh mục cũ.",
    );

    await mongoose.disconnect();
};

run().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
});
