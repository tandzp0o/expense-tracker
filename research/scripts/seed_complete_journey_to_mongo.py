from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Iterable

REPO_ROOT = Path(__file__).resolve().parents[2]
LOCAL_PYTHON = REPO_ROOT / "research" / ".python"
if LOCAL_PYTHON.exists():
    sys.path.insert(0, str(LOCAL_PYTHON))

import numpy as np
import pandas as pd
import pyreadr
from bson import ObjectId
from pymongo import MongoClient


DEFAULT_DB = "expense-tracker-complete-journey"
RAW_DIR = REPO_ROOT / "research" / "datasets" / "complete-journey" / "raw"
PROCESSED_DIR = REPO_ROOT / "research" / "datasets" / "complete-journey" / "processed"
ENV_PATH = REPO_ROOT / "be" / ".env"
VND_PER_USD = 25_000

EXPENSE_CATEGORIES = [
    "Ăn uống",
    "Di chuyển",
    "Mua sắm",
    "Giải trí",
    "Sức khỏe",
    "Giáo dục",
    "Hóa đơn",
    "Khác",
]

INCOME_MIDPOINT_USD = {
    "Under 15K": 12_000,
    "15-24K": 20_000,
    "25-34K": 30_000,
    "35-49K": 42_500,
    "50-74K": 62_500,
    "75-99K": 87_500,
    "100-124K": 112_500,
    "125-149K": 137_500,
    "150-174K": 162_500,
    "175-199K": 187_500,
    "200K+": 220_000,
}


def read_env_value(path: Path, key: str) -> str:
    if not path.exists():
        raise FileNotFoundError(f"Không tìm thấy file env: {path}")

    pattern = re.compile(rf"^\s*{re.escape(key)}\s*=\s*(.*)\s*$")
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        match = pattern.match(raw_line)
        if not match:
            continue
        value = match.group(1).strip()
        if value and value[0] in {"'", '"'} and value[-1:] == value[0]:
            value = value[1:-1]
        return value

    raise KeyError(f"Không tìm thấy {key} trong {path}")


def read_r_frame(path: Path) -> pd.DataFrame:
    result = pyreadr.read_r(str(path))
    if not result:
        raise ValueError(f"Không đọc được dữ liệu từ {path}")
    return next(iter(result.values()))


def clean_text(value: Any) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


def household_uid(household_id: Any) -> str:
    return f"cj_hh_{clean_text(household_id)}"


def round_vnd(value: float) -> int:
    return max(1_000, int(round(float(value) / 1_000) * 1_000))


def income_monthly_vnd(income_band: str) -> int:
    annual_usd = INCOME_MIDPOINT_USD.get(income_band, 50_000)
    return round_vnd((annual_usd / 12) * VND_PER_USD)


def map_expense_category(department: Any, product_category: Any, product_type: Any) -> str:
    text = " ".join(
        part.upper()
        for part in [clean_text(department), clean_text(product_category), clean_text(product_type)]
        if part
    )

    if any(k in text for k in ["AUTO", "GASOLINE", "MOTOR", "CAR CARE"]):
        return "Di chuyển"
    if any(k in text for k in ["PHARM", "MEDIC", "VITAMIN", "HEALTH", "DENTAL", "FIRST AID", "EYE CARE"]):
        return "Sức khỏe"
    if any(k in text for k in ["BOOK", "MAGAZINE", "SCHOOL", "EDUCATION", "STATIONERY"]):
        return "Giáo dục"
    if any(k in text for k in ["UTILITY", "SERVICE", "BILL", "TELEPHONE"]):
        return "Hóa đơn"
    if any(k in text for k in ["VIDEO", "AUDIO", "TOYS", "GAME", "PHOTO", "PARTY"]):
        return "Giải trí"
    if any(
        k in text
        for k in [
            "GROCERY",
            "PRODUCE",
            "MEAT",
            "SEAFOOD",
            "DELI",
            "PASTRY",
            "RESTAURANT",
            "SPIRITS",
            "NUTRITION",
            "BREAD",
            "FRUIT",
            "VEGETABLE",
            "CEREAL",
            "COFFEE",
            "TEA",
            "SNACK",
            "DAIRY",
            "CHEESE",
            "YOGURT",
            "FROZEN",
        ]
    ):
        return "Ăn uống"
    if any(
        k in text
        for k in [
            "HOUSE",
            "HOME",
            "CLEAN",
            "LAUNDRY",
            "PAPER",
            "PET",
            "COSMETIC",
            "BEAUTY",
            "FLORAL",
            "DRUG GM",
            "GENERAL",
        ]
    ):
        return "Mua sắm"
    return "Khác"


def to_python_doc(doc: dict[str, Any]) -> dict[str, Any]:
    clean: dict[str, Any] = {}
    for key, value in doc.items():
        if isinstance(value, pd.Timestamp):
            clean[key] = value.to_pydatetime()
        elif pd.isna(value) if not isinstance(value, (list, dict, tuple, ObjectId)) else False:
            clean[key] = None
        else:
            clean[key] = value
    return clean


def insert_batches(collection, docs: Iterable[dict[str, Any]], batch_size: int) -> int:
    count = 0
    batch: list[dict[str, Any]] = []
    for doc in docs:
        batch.append(to_python_doc(doc))
        if len(batch) >= batch_size:
            collection.insert_many(batch, ordered=False)
            count += len(batch)
            print(f"  inserted {count:,} into {collection.name}")
            batch = []
    if batch:
        collection.insert_many(batch, ordered=False)
        count += len(batch)
        print(f"  inserted {count:,} into {collection.name}")
    return count


def reset_collections(db, db_name: str) -> None:
    allowed_tokens = ("research", "complete-journey", "complete_journey")
    if not any(token in db_name for token in allowed_tokens):
        raise RuntimeError(
            f"Từ chối reset DB '{db_name}'. Hãy dùng tên DB nghiên cứu hoặc truyền --no-reset."
        )

    for name in [
        "users",
        "wallets",
        "transactions",
        "budgets",
        "goals",
        "research_seed_metadata",
    ]:
        db[name].delete_many({})


def create_indexes(db) -> None:
    db.users.create_index("uid", unique=True)
    db.users.create_index("email", unique=True)
    db.users.create_index("username", unique=True, sparse=True)
    db.wallets.create_index("userId")
    db.transactions.create_index([("userId", 1), ("date", -1), ("createdAt", -1)])
    db.transactions.create_index([("userId", 1), ("type", 1), ("date", -1), ("createdAt", -1)])
    db.transactions.create_index([("userId", 1), ("status", 1), ("date", -1), ("createdAt", -1)])
    db.transactions.create_index([("userId", 1), ("category", 1), ("date", -1), ("createdAt", -1)])
    db.transactions.create_index([("sourceDataset", 1), ("sourceBasketId", 1), ("sourceProductId", 1)])
    db.budgets.create_index(
        [("userId", 1), ("walletId", 1), ("category", 1), ("month", 1), ("year", 1)],
        unique=True,
    )
    db.goals.create_index("userId")


def build_seed(args: argparse.Namespace) -> dict[str, Any]:
    print("Reading Complete Journey files...")
    demographics = read_r_frame(RAW_DIR / "demographics.rda")
    products = read_r_frame(RAW_DIR / "products.rda")
    transactions = read_r_frame(RAW_DIR / "transactions.rds")

    demographics = demographics.copy()
    products = products.copy()
    transactions = transactions.copy()

    demographics["household_id"] = demographics["household_id"].map(clean_text)
    products["product_id"] = products["product_id"].map(clean_text)
    transactions["household_id"] = transactions["household_id"].map(clean_text)
    transactions["product_id"] = transactions["product_id"].map(clean_text)

    if args.max_households:
        household_counts = transactions["household_id"].value_counts()
        selected_households = set(household_counts.head(args.max_households).index)
        demographics = demographics[demographics["household_id"].isin(selected_households)].copy()

    household_ids = set(demographics["household_id"].dropna().astype(str))
    transactions = transactions[transactions["household_id"].isin(household_ids)].copy()
    transactions = transactions[transactions["sales_value"].fillna(0) > 0].copy()
    if args.max_expense_transactions_per_household:
        limit = int(args.max_expense_transactions_per_household)
        sampled_frames: list[pd.DataFrame] = []
        transactions = transactions.sort_values(["household_id", "transaction_timestamp"])
        for _, group in transactions.groupby("household_id", sort=False):
            if len(group) <= limit:
                sampled_frames.append(group)
                continue
            positions = np.linspace(0, len(group) - 1, limit).round().astype(int)
            sampled_frames.append(group.iloc[positions])
        transactions = pd.concat(sampled_frames, ignore_index=True)

    if args.max_expense_transactions:
        transactions = transactions.sort_values(["household_id", "transaction_timestamp"]).head(
            args.max_expense_transactions
        )

    products_lookup = products[["product_id", "department", "product_category", "product_type"]].drop_duplicates(
        "product_id"
    )
    transactions = transactions.merge(products_lookup, on="product_id", how="left")
    transactions["date"] = pd.to_datetime(transactions["transaction_timestamp"], errors="coerce")
    transactions = transactions.dropna(subset=["date"]).copy()
    transactions["amount_vnd"] = (transactions["sales_value"].astype(float) * VND_PER_USD).round(-3).astype(int)
    transactions.loc[transactions["amount_vnd"] < 1_000, "amount_vnd"] = 1_000
    transactions["category"] = transactions.apply(
        lambda row: map_expense_category(row["department"], row["product_category"], row["product_type"]),
        axis=1,
    )
    transactions["userId"] = transactions["household_id"].map(household_uid)
    transactions["year"] = transactions["date"].dt.year.astype(int)
    transactions["month"] = transactions["date"].dt.month.astype(int)

    now = dt.datetime.now(dt.timezone.utc)
    user_ids = sorted(household_ids, key=lambda value: int(value) if value.isdigit() else value)
    wallet_ids = {household_uid(hid): ObjectId() for hid in user_ids}

    income_map = {
        household_uid(row["household_id"]): income_monthly_vnd(clean_text(row["income"]))
        for _, row in demographics.iterrows()
    }
    user_months = (
        transactions[["userId", "year", "month"]]
        .drop_duplicates()
        .sort_values(["userId", "year", "month"])
    )
    income_totals = user_months.groupby("userId").size().to_dict()
    expense_totals = transactions.groupby("userId")["amount_vnd"].sum().to_dict()
    ratio_by_user = {}
    for uid in [household_uid(hid) for hid in user_ids]:
        total_income = income_map.get(uid, income_monthly_vnd("")) * income_totals.get(uid, 0)
        ratio_by_user[uid] = float(expense_totals.get(uid, 0) / max(total_income, 1))

    ratio_series = pd.Series(ratio_by_user)
    low_ratio = float(ratio_series.quantile(0.33)) if len(ratio_series) else 0.0
    high_ratio = float(ratio_series.quantile(0.66)) if len(ratio_series) else 0.0

    demographics_by_household = {
        clean_text(row["household_id"]): row
        for _, row in demographics.iterrows()
    }

    users: list[dict[str, Any]] = []
    wallets: list[dict[str, Any]] = []
    goals: list[dict[str, Any]] = []
    income_transactions: list[dict[str, Any]] = []

    months_by_user = {
        uid: rows[["year", "month"]].to_dict("records")
        for uid, rows in user_months.groupby("userId")
    }

    for household_id in user_ids:
        uid = household_uid(household_id)
        demo = demographics_by_household.get(household_id)
        monthly_income = income_map.get(uid, income_monthly_vnd(""))
        months = months_by_user.get(uid, [])
        total_income = monthly_income * len(months)
        total_expense = int(expense_totals.get(uid, 0))
        ratio = ratio_by_user.get(uid, 0.0)
        goal_base = max(round_vnd(total_income * 0.12), monthly_income)

        goal_status = "completed" if ratio <= low_ratio else "active"
        goal_current = goal_base if goal_status == "completed" else round_vnd(goal_base * (0.65 if ratio <= high_ratio else 0.25))
        goal_id = ObjectId()
        goals.append(
            {
                "_id": goal_id,
                "userId": uid,
                "title": "Quỹ dự phòng gia đình",
                "description": "Seed nghiên cứu từ Complete Journey.",
                "targetAmount": goal_base,
                "currentAmount": goal_current,
                "category": "Tiết kiệm",
                "deadline": now + dt.timedelta(days=365),
                "status": goal_status,
                "createdAt": now,
                "updatedAt": now,
                "sourceDataset": "complete-journey",
            }
        )
        goals_completed = 1 if goal_status == "completed" else 0
        goals_active = 0 if goal_status == "completed" else 1

        if ratio <= low_ratio:
            second_goal = max(round_vnd(total_income * 0.04), round_vnd(monthly_income * 0.5))
            goals.append(
                {
                    "_id": ObjectId(),
                    "userId": uid,
                    "title": "Mục tiêu tối ưu chi tiêu",
                    "description": "Seed nghiên cứu từ hành vi tiết kiệm tốt.",
                    "targetAmount": second_goal,
                    "currentAmount": round_vnd(second_goal * 0.55),
                    "category": "Tiết kiệm",
                    "deadline": now + dt.timedelta(days=180),
                    "status": "active",
                    "createdAt": now,
                    "updatedAt": now,
                    "sourceDataset": "complete-journey",
                }
            )
            goals_active += 1

        wallet_id = wallet_ids[uid]
        wallet_balance = int(total_income - total_expense - sum(g["currentAmount"] for g in goals if g["userId"] == uid))
        wallets.append(
            {
                "_id": wallet_id,
                "userId": uid,
                "name": "Ví Complete Journey",
                "description": "Ví nghiên cứu seed từ dataset Complete Journey.",
                "balance": wallet_balance,
                "initialBalance": 0,
                "type": "cash",
                "currency": "VND",
                "isArchived": False,
                "hasTransactions": bool(months),
                "createdAt": now,
                "updatedAt": now,
                "sourceDataset": "complete-journey",
                "sourceHouseholdId": household_id,
            }
        )
        users.append(
            {
                "uid": uid,
                "email": f"{uid}@completejourney.local",
                "username": uid,
                "displayName": f"Hộ Complete Journey {household_id}",
                "hasPassword": False,
                "authProviders": [],
                "totalBalance": wallet_balance,
                "totalIncome": int(total_income),
                "totalExpense": total_expense,
                "goalsCompleted": goals_completed,
                "goalsActive": goals_active,
                "newUser": False,
                "transactionCacheVersion": 1,
                "transactionsUpdatedAt": now,
                "createdAt": now,
                "updatedAt": now,
                "sourceDataset": "complete-journey",
                "sourceHouseholdId": household_id,
                "researchProfile": {
                    "age": clean_text(demo["age"]) if demo is not None else "",
                    "income": clean_text(demo["income"]) if demo is not None else "",
                    "homeOwnership": clean_text(demo["home_ownership"]) if demo is not None else "",
                    "maritalStatus": clean_text(demo["marital_status"]) if demo is not None else "",
                    "householdSize": clean_text(demo["household_size"]) if demo is not None else "",
                    "householdComp": clean_text(demo["household_comp"]) if demo is not None else "",
                    "kidsCount": clean_text(demo["kids_count"]) if demo is not None else "",
                    "monthlyIncomeVnd": monthly_income,
                },
            }
        )

        for item in months:
            income_transactions.append(
                {
                    "_id": ObjectId(),
                    "userId": uid,
                    "walletId": wallet_id,
                    "type": "INCOME",
                    "status": "COMPLETED",
                    "amount": monthly_income,
                    "category": "Lương",
                    "date": dt.datetime(int(item["year"]), int(item["month"]), 1, 8, 0, 0, tzinfo=dt.timezone.utc),
                    "note": "Thu nhập tháng ước lượng từ demographic income của Complete Journey.",
                    "isSystemGenerated": True,
                    "isDeletable": False,
                    "createdAt": now,
                    "sourceDataset": "complete-journey",
                    "sourceKind": "estimated-income",
                }
            )

    budget_groups = (
        transactions.groupby(["userId", "year", "month", "category"], as_index=False)["amount_vnd"].sum()
    )
    budgets: list[dict[str, Any]] = []
    for _, row in budget_groups.iterrows():
        spent = int(row["amount_vnd"])
        amount = round_vnd(max(spent * 1.12, spent + 50_000))
        budgets.append(
            {
                "_id": ObjectId(),
                "userId": row["userId"],
                "walletId": wallet_ids[row["userId"]],
                "category": row["category"],
                "categoryType": "standard",
                "amount": amount,
                "month": int(row["month"]),
                "year": int(row["year"]),
                "note": "Ngân sách seed từ chi tiêu Complete Journey theo tháng.",
                "createdAt": now,
                "updatedAt": now,
                "sourceDataset": "complete-journey",
                "sourceSpent": spent,
            }
        )

    def expense_docs() -> Iterable[dict[str, Any]]:
        for _, row in transactions.iterrows():
            yield {
                "_id": ObjectId(),
                "userId": row["userId"],
                "walletId": wallet_ids[row["userId"]],
                "type": "EXPENSE",
                "status": "COMPLETED",
                "amount": int(row["amount_vnd"]),
                "category": row["category"],
                "date": row["date"].to_pydatetime(),
                "note": f"CJ basket {clean_text(row['basket_id'])}",
                "isSystemGenerated": False,
                "isDeletable": True,
                "createdAt": now,
                "sourceDataset": "complete-journey",
                "sourceHouseholdId": clean_text(row["household_id"]),
                "sourceBasketId": clean_text(row["basket_id"]),
                "sourceProductId": clean_text(row["product_id"]),
                "sourceStoreId": clean_text(row["store_id"]),
                "sourceSalesValueUsd": float(row["sales_value"]),
            }

    category_counts = transactions["category"].value_counts().to_dict()
    monthly_record_count = int(transactions[["userId", "year", "month"]].drop_duplicates().shape[0])
    return {
        "users": users,
        "wallets": wallets,
        "goals": goals,
        "budgets": budgets,
        "income_transactions": income_transactions,
        "expense_docs": expense_docs,
        "expense_count": int(len(transactions)),
        "monthly_record_count": monthly_record_count,
        "category_counts": {str(k): int(v) for k, v in category_counts.items()},
        "source_households": int(len(user_ids)),
        "source_products": int(products.shape[0]),
        "source_transactions_loaded": int(transactions.shape[0]),
    }


def seed(args: argparse.Namespace) -> dict[str, Any]:
    mongo_uri = args.mongo_uri or os.environ.get("MONGO_URI") or read_env_value(ENV_PATH, "MONGO_URI")
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=15_000)
    client.admin.command("ping")
    db = client[args.database]

    payload = build_seed(args)

    if args.reset:
        print(f"Resetting research collections in database '{args.database}'...")
        reset_collections(db, args.database)

    print("Creating indexes...")
    create_indexes(db)

    inserted = {}
    print("Inserting users/wallets/goals/budgets/income...")
    for name in ["users", "wallets", "goals", "budgets"]:
        inserted[name] = insert_batches(db[name], payload[name], args.batch_size)
    inserted["income_transactions"] = insert_batches(
        db.transactions,
        payload["income_transactions"],
        args.batch_size,
    )

    print("Inserting expense transactions...")
    inserted["expense_transactions"] = insert_batches(
        db.transactions,
        payload["expense_docs"](),
        args.batch_size,
    )

    total_transactions = inserted["income_transactions"] + inserted["expense_transactions"]
    metadata = {
        "dataset": "complete-journey",
        "database": args.database,
        "seededAt": dt.datetime.now(dt.timezone.utc),
        "source": {
            "rawDir": str(RAW_DIR),
            "households": payload["source_households"],
            "products": payload["source_products"],
            "expenseTransactions": payload["expense_count"],
            "monthlyUserRecords": payload["monthly_record_count"],
            "categoryCounts": payload["category_counts"],
            "sampling": {
                "maxHouseholds": int(args.max_households),
                "maxExpenseTransactions": int(args.max_expense_transactions),
                "maxExpenseTransactionsPerHousehold": int(args.max_expense_transactions_per_household),
            },
        },
        "inserted": {
            **inserted,
            "transactions": total_transactions,
        },
        "mapping": {
            "income": "Ước lượng thu nhập tháng từ demographic income band.",
            "expense": f"sales_value nhân {VND_PER_USD} để đổi USD sang VND.",
            "category": EXPENSE_CATEGORIES,
        },
    }
    db.research_seed_metadata.insert_one(metadata)

    report = {
        **metadata,
        "seededAt": metadata["seededAt"].isoformat(),
    }
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    report_path = PROCESSED_DIR / "mongo_seed_report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    print("Seed complete.")
    print(json.dumps(report["inserted"], ensure_ascii=False, indent=2))
    print(f"Report: {report_path}")
    client.close()
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed Complete Journey data into a MongoDB database compatible with expense-tracker."
    )
    parser.add_argument("--database", default=DEFAULT_DB)
    parser.add_argument("--mongo-uri", default=None, help="Nếu bỏ trống sẽ đọc MONGO_URI từ be/.env.")
    parser.add_argument("--batch-size", type=int, default=5_000)
    parser.add_argument("--max-households", type=int, default=0, help="0 nghĩa là dùng toàn bộ household có demographic.")
    parser.add_argument("--max-expense-transactions", type=int, default=0, help="0 nghĩa là không giới hạn.")
    parser.add_argument(
        "--max-expense-transactions-per-household",
        type=int,
        default=0,
        help="0 nghĩa là không giới hạn. Nên dùng khi seed lên Atlas free tier.",
    )
    parser.add_argument("--no-reset", dest="reset", action="store_false")
    parser.set_defaults(reset=True)
    return parser.parse_args()


if __name__ == "__main__":
    seed(parse_args())
