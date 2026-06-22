from __future__ import annotations

"""
AI RECOMMENDER - ALL IN ONE
===========================

Mục tiêu file này:
1) Gom toàn bộ pipeline AI vào một file duy nhất để dễ đọc / dễ demo / dễ bảo trì giai đoạn đầu.
2) Giải thích rõ từng bước lớn, đầu vào/đầu ra, mục đích của từng bước.
3) Hỗ trợ 2 luồng chính:
   - train: đọc dữ liệu -> tạo feature -> phân cụm 2 tầng -> chọn leader -> lưu artifacts
   - recommend: nạp artifacts + dữ liệu mới -> tạo context gợi ý cho 1 user

Ví dụ chạy:
-----------
Train:
python ai_recommender_all_in_one.py train --mongo-uri "mongodb+srv://tannguyen0916:tannguyen0916@ton.tjmgh.mongodb.net/expense-tracker?retryWrites=true&w=majority" --export-viz

Recommend:
python ai_recommender_all_in_one.py recommend --mongo-uri "mongodb+srv://tannguyen0916:tannguyen0916@ton.tjmgh.mongodb.net/expense-tracker?retryWrites=true&w=majority" --user-id "YWpffaf3vzVDhD9KmAfktc8NsUr2"
"""

import argparse
import json
import pickle
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from pymongo import MongoClient
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler


# ============================================================================
# [PHẦN 1] CẤU HÌNH CHUNG
# ----------------------------------------------------------------------------
# Mục đích:
# - Chuẩn hóa category chi tiêu dùng cho feature engineering.
# - Khai báo tham số mặc định của pipeline.
# ============================================================================

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


@dataclass(frozen=True)
class ModelConfig:
    database: str = "expense-tracker"
    macro_k: int = 3
    micro_k: int = 3
    random_state: int = 42
    artifacts_dir: Path = Path(__file__).parent / "artifacts"


# ============================================================================
# [PHẦN 2] CHUẨN HÓA TEXT / CATEGORY
# ----------------------------------------------------------------------------
# Mục đích:
# - Sửa lỗi mojibake (lỗi dấu tiếng Việt do encoding).
# - Map các category phát sinh về lớp chuẩn để tránh làm loãng feature.
# ============================================================================

MOJIBAKE_MAP = {
    "Ä‚n uá»‘ng": "Ăn uống",
    "Di chuyá»ƒn": "Di chuyển",
    "Mua sáº¯m": "Mua sắm",
    "Giáº£i trÃ­": "Giải trí",
    "Sá»©c khá»e": "Sức khỏe",
    "GiÃ¡o dá»¥c": "Giáo dục",
    "HÃ³a Ä‘Æ¡n": "Hóa đơn",
    "KhÃ¡c": "Khác",
    "KhÃ´ng táº¡o sá»‘ liá»‡u ngoÃ i context. ÄÆ°a ra gá»£i Ã½ hÃ nh Ä‘á»™ng cá»¥ thá»ƒ.": "Không tạo số liệu ngoài context. Đưa ra gợi ý hành động cụ thể.",
}

CATEGORY_ALIAS_MAP = {
    "dịch vụ, mua sắm": "Mua sắm",
    "dich vu, mua sam": "Mua sắm",
    "mua sắm": "Mua sắm",
    "mua sam": "Mua sắm",
    "lặt vặt": "Khác",
    "lat vat": "Khác",
    "chăm vợ": "Giải trí",
    "cham vo": "Giải trí",
    "ăn uống": "Ăn uống",
    "an uong": "Ăn uống",
    "di chuyển": "Di chuyển",
    "di chuyen": "Di chuyển",
    "giải trí": "Giải trí",
    "giai tri": "Giải trí",
    "sức khỏe": "Sức khỏe",
    "suc khoe": "Sức khỏe",
    "giáo dục": "Giáo dục",
    "giao duc": "Giáo dục",
    "hóa đơn": "Hóa đơn",
    "hoa don": "Hóa đơn",
    "khác": "Khác",
    "khac": "Khác",
}


def normalize_vi_text(value: str) -> str:
    """Chuẩn hóa chuỗi tiếng Việt bị lỗi encoding."""
    if not isinstance(value, str):
        return value
    if value in MOJIBAKE_MAP:
        return MOJIBAKE_MAP[value]
    try:
        repaired = value.encode("latin1").decode("utf-8")
        if repaired:
            value = repaired
    except Exception:
        pass
    return MOJIBAKE_MAP.get(value, value)


def normalize_category(value: str) -> str:
    """
    Chuẩn hóa category đầu vào:
    1) sửa text lỗi dấu
    2) map alias về lớp chuẩn
    """
    text = normalize_vi_text(value or "")
    key = text.strip().lower()
    return CATEGORY_ALIAS_MAP.get(key, text)


# ============================================================================
# [PHẦN 3] ĐỌC DỮ LIỆU TỪ MONGODB
# ----------------------------------------------------------------------------
# Mục đích:
# - Tải dữ liệu gốc từ các collection cần thiết.
# - Trả về DataFrame để pipeline xử lý feature.
# ============================================================================

def _to_df(docs: list[dict]) -> pd.DataFrame:
    return pd.DataFrame(docs) if docs else pd.DataFrame()


def load_collections(mongo_uri: str, database: str) -> Dict[str, pd.DataFrame]:
    client = MongoClient(mongo_uri)
    db = client[database]

    users = _to_df(
        list(
            db.users.find(
                {},
                {
                    "_id": 0,
                    "uid": 1,
                    "email": 1,
                    "displayName": 1,
                    "totalIncome": 1,
                    "goalsCompleted": 1,
                    "goalsActive": 1,
                },
            )
        )
    )
    wallets = _to_df(list(db.wallets.find({}, {"_id": 1, "userId": 1, "name": 1})))
    budgets = _to_df(
        list(
            db.budgets.find(
                {},
                {
                    "_id": 0,
                    "userId": 1,
                    "walletId": 1,
                    "category": 1,
                    "amount": 1,
                    "month": 1,
                    "year": 1,
                },
            )
        )
    )
    goals = _to_df(
        list(
            db.goals.find(
                {},
                {
                    "_id": 0,
                    "userId": 1,
                    "title": 1,
                    "targetAmount": 1,
                    "currentAmount": 1,
                    "status": 1,
                },
            )
        )
    )
    transactions = _to_df(
        list(
            db.transactions.find(
                {},
                {
                    "_id": 0,
                    "userId": 1,
                    "walletId": 1,
                    "type": 1,
                    "status": 1,
                    "amount": 1,
                    "category": 1,
                    "date": 1,
                    "note": 1,
                },
            )
        )
    )

    client.close()
    return {
        "users": users,
        "wallets": wallets,
        "budgets": budgets,
        "goals": goals,
        "transactions": transactions,
    }


# ============================================================================
# [PHẦN 4] FEATURE ENGINEERING THEO USER-THÁNG
# ----------------------------------------------------------------------------
# Mục đích:
# - Chuyển dữ liệu giao dịch thô thành ma trận đặc trưng cho ML.
# - Các feature chính:
#   income, expense, expense_to_income_ratio, cat_share_*, anomaly_count,
#   target_saving_ratio, goal_completion_rate.
# ============================================================================

def _safe_div(a: float, b: float) -> float:
    return 0.0 if b == 0 else float(a) / float(b)


def build_monthly_features(
    users: pd.DataFrame,
    goals: pd.DataFrame,
    transactions: pd.DataFrame,
) -> pd.DataFrame:
    tx = transactions.copy()
    if "category" in tx.columns:
        tx["category"] = tx["category"].apply(normalize_category)

    tx["date"] = pd.to_datetime(tx["date"], errors="coerce")
    tx = tx.dropna(subset=["date", "userId", "type", "amount"])
    tx["ym"] = tx["date"].dt.to_period("M").astype(str)

    income = (
        tx[tx["type"] == "INCOME"]
        .groupby(["userId", "ym"], as_index=False)["amount"]
        .sum()
        .rename(columns={"amount": "income"})
    )
    expense = (
        tx[tx["type"] == "EXPENSE"]
        .groupby(["userId", "ym"], as_index=False)["amount"]
        .sum()
        .rename(columns={"amount": "expense"})
    )
    base = pd.merge(income, expense, on=["userId", "ym"], how="outer").fillna(0)

    # Tỷ trọng danh mục chi tiêu
    expense_tx = tx[tx["type"] == "EXPENSE"].copy()
    cat = expense_tx.groupby(["userId", "ym", "category"], as_index=False)["amount"].sum()
    cat_pivot = cat.pivot_table(
        index=["userId", "ym"],
        columns="category",
        values="amount",
        fill_value=0,
        aggfunc="sum",
    )
    for c in EXPENSE_CATEGORIES:
        if c not in cat_pivot.columns:
            cat_pivot[c] = 0
    cat_pivot = cat_pivot[EXPENSE_CATEGORIES].reset_index()
    cat_sum = cat_pivot[EXPENSE_CATEGORIES].sum(axis=1).replace(0, np.nan)
    for c in EXPENSE_CATEGORIES:
        cat_pivot[f"cat_share_{c}"] = (cat_pivot[c] / cat_sum).fillna(0.0)
    cat_pivot = cat_pivot.drop(columns=EXPENSE_CATEGORIES)
    base = base.merge(cat_pivot, on=["userId", "ym"], how="left").fillna(0)

    # Đếm anomaly bằng IsolationForest trên amount EXPENSE theo từng user
    anomaly_frames: List[pd.DataFrame] = []
    for _, g in expense_tx.groupby("userId"):
        if len(g) < 15:
            tmp = g[["userId", "ym"]].copy()
            tmp["is_anomaly"] = 0
            anomaly_frames.append(tmp)
            continue
        model = IsolationForest(n_estimators=120, contamination=0.08, random_state=42)
        pred = model.fit_predict(g[["amount"]].astype(float).values)
        tmp = g[["userId", "ym"]].copy()
        tmp["is_anomaly"] = (pred == -1).astype(int)
        anomaly_frames.append(tmp)

    anomaly = pd.concat(anomaly_frames, ignore_index=True)
    anomaly = (
        anomaly.groupby(["userId", "ym"], as_index=False)["is_anomaly"]
        .sum()
        .rename(columns={"is_anomaly": "anomaly_count"})
    )
    base = base.merge(anomaly, on=["userId", "ym"], how="left").fillna({"anomaly_count": 0})

    # Feature mục tiêu tài chính từ goals + users
    goal_agg = goals.groupby("userId", as_index=False).agg(
        total_goal_target=("targetAmount", "sum"),
        goals_active=("status", lambda s: int((s == "active").sum())),
        goals_completed=("status", lambda s: int((s == "completed").sum())),
    )
    user_features = users[["uid", "totalIncome", "goalsCompleted", "goalsActive"]].rename(
        columns={"uid": "userId"}
    )
    user_features = user_features.merge(goal_agg, on="userId", how="left").fillna(0)
    base = base.merge(user_features, on="userId", how="left").fillna(0)

    base["expense_to_income_ratio"] = base.apply(
        lambda r: _safe_div(r["expense"], max(r["income"], 1)),
        axis=1,
    )
    base["target_saving_ratio"] = base.apply(
        lambda r: _safe_div(r["total_goal_target"], max(r["totalIncome"], 1)),
        axis=1,
    )
    base["goal_completion_rate"] = base.apply(
        lambda r: _safe_div(
            r["goals_completed"],
            max(r["goals_completed"] + r["goals_active"], 1),
        ),
        axis=1,
    )
    base["month_income_feature"] = base["income"]
    base["anomaly_count"] = base["anomaly_count"].astype(int)

    return base.sort_values(["userId", "ym"]).reset_index(drop=True)


# ============================================================================
# [PHẦN 5] PHÂN CỤM 2 TẦNG (MACRO + MICRO)
# ----------------------------------------------------------------------------
# Mục đích:
# - Macro cluster: năng lực tài chính
# - Micro cluster: hành vi chi tiêu trong từng macro
# ============================================================================

@dataclass
class ClusterArtifacts:
    macro_scaler: StandardScaler
    macro_model: KMeans
    micro_scalers: Dict[int, StandardScaler]
    micro_models: Dict[int, KMeans]
    feature_columns_micro: List[str]


def train_two_level_clustering(
    features: pd.DataFrame,
    macro_k: int = 3,
    micro_k: int = 3,
    random_state: int = 42,
) -> tuple[pd.DataFrame, ClusterArtifacts]:
    df = features.copy()

    # Tầng 1 - Macro
    macro_x = df[["month_income_feature", "target_saving_ratio"]].astype(float)
    macro_scaler = StandardScaler()
    macro_xs = macro_scaler.fit_transform(macro_x)
    macro_model = KMeans(n_clusters=macro_k, n_init=20, random_state=random_state)
    df["macro_cluster"] = macro_model.fit_predict(macro_xs)

    # Tầng 2 - Micro
    micro_base_cols = ["expense_to_income_ratio", "anomaly_count", "goal_completion_rate"]
    share_cols = [c for c in df.columns if c.startswith("cat_share_")]
    micro_cols = micro_base_cols + share_cols

    micro_scalers: Dict[int, StandardScaler] = {}
    micro_models: Dict[int, KMeans] = {}
    df["micro_cluster"] = -1

    for macro_id, g in df.groupby("macro_cluster"):
        k = min(micro_k, len(g))
        if k <= 1:
            df.loc[g.index, "micro_cluster"] = 0
            continue

        scaler = StandardScaler()
        xs = scaler.fit_transform(g[micro_cols].astype(float))
        model = KMeans(n_clusters=k, n_init=20, random_state=random_state)
        labels = model.fit_predict(xs)
        df.loc[g.index, "micro_cluster"] = labels

        micro_scalers[int(macro_id)] = scaler
        micro_models[int(macro_id)] = model

    artifacts = ClusterArtifacts(
        macro_scaler=macro_scaler,
        macro_model=macro_model,
        micro_scalers=micro_scalers,
        micro_models=micro_models,
        feature_columns_micro=micro_cols,
    )
    return df, artifacts


def summarize_clusters(df: pd.DataFrame) -> dict:
    """Tạo báo cáo nhanh để đọc tình trạng phân cụm."""
    report = {"records": int(len(df)), "macro": {}}
    for macro_id, mg in df.groupby("macro_cluster"):
        key = str(int(macro_id))
        report["macro"][key] = {
            "size": int(len(mg)),
            "avg_income": float(np.mean(mg["month_income_feature"])),
            "avg_expense_income_ratio": float(np.mean(mg["expense_to_income_ratio"])),
            "micro": {},
        }
        for micro_id, sg in mg.groupby("micro_cluster"):
            report["macro"][key]["micro"][str(int(micro_id))] = {
                "size": int(len(sg)),
                "avg_anomaly": float(np.mean(sg["anomaly_count"])),
                "avg_goal_completion": float(np.mean(sg["goal_completion_rate"])),
            }
    return report


# ============================================================================
# [PHẦN 6] CHỌN USER HÌNH MẪU (LEADER BASELINE)
# ----------------------------------------------------------------------------
# Mục đích:
# - Tạo baseline thực tế trong từng cụm để so sánh và đưa ra gợi ý.
# ============================================================================

def build_leaders(clustered_df: pd.DataFrame) -> dict:
    leaders: Dict[str, list[dict]] = {}
    for (macro_id, micro_id), g in clustered_df.groupby(["macro_cluster", "micro_cluster"]):
        gg = g.copy()
        gg["leader_score"] = (
            gg["goal_completion_rate"] * 2.0
            - gg["anomaly_count"] * 0.15
            - gg["expense_to_income_ratio"] * 0.3
        )
        top = gg.sort_values("leader_score", ascending=False).head(3)
        key = f"{int(macro_id)}:{int(micro_id)}"
        leaders[key] = [
            {
                "userId": row["userId"],
                "ym": row["ym"],
                "leader_score": float(row["leader_score"]),
                "expense_to_income_ratio": float(row["expense_to_income_ratio"]),
                "goal_completion_rate": float(row["goal_completion_rate"]),
                "anomaly_count": int(row["anomaly_count"]),
                "category_distribution": {
                    col.replace("cat_share_", ""): float(row[col])
                    for col in gg.columns
                    if col.startswith("cat_share_")
                },
            }
            for _, row in top.iterrows()
        ]
    return leaders


# ============================================================================
# [PHẦN 7] DỰ BÁO CHI TIÊU CUỐI THÁNG
# ----------------------------------------------------------------------------
# Mục đích:
# - Dự báo nhanh chi tiêu EOM (end-of-month) để phát hiện nguy cơ thâm hụt.
# ============================================================================

def forecast_month_end_expense(transactions: pd.DataFrame, user_id: str, ym: str) -> dict:
    tx = transactions.copy()
    tx["date"] = pd.to_datetime(tx["date"], errors="coerce")
    tx = tx.dropna(subset=["date"])
    tx["ym"] = tx["date"].dt.to_period("M").astype(str)

    mtx = tx[(tx["userId"] == user_id) & (tx["ym"] == ym) & (tx["type"] == "EXPENSE")].copy()
    if mtx.empty:
        return {"predicted_expense_eom": 0.0, "observed_so_far": 0.0, "method": "empty"}

    mtx["day"] = mtx["date"].dt.day
    daily = mtx.groupby("day", as_index=False)["amount"].sum().sort_values("day")
    daily["cum_expense"] = daily["amount"].cumsum()
    observed = float(daily["cum_expense"].iloc[-1])
    last_day_seen = int(daily["day"].iloc[-1])
    month_end = int(mtx["date"].dt.days_in_month.iloc[0])

    if len(daily) >= 4:
        model = LinearRegression()
        model.fit(daily[["day"]].values, daily["cum_expense"].values)
        pred = float(model.predict(np.array([[month_end]])).item())
        pred = max(pred, observed)
        return {
            "predicted_expense_eom": pred,
            "observed_so_far": observed,
            "method": "linear_regression",
            "last_day_seen": last_day_seen,
        }

    avg_per_day = observed / max(last_day_seen, 1)
    return {
        "predicted_expense_eom": float(avg_per_day * month_end),
        "observed_so_far": observed,
        "method": "moving_average",
        "last_day_seen": last_day_seen,
    }


# ============================================================================
# [PHẦN 8] TẠO CONTEXT GỢI Ý CHO LLM
# ----------------------------------------------------------------------------
# Mục đích:
# - Trả về JSON context có cấu trúc.
# - Đảm bảo LLM có dữ kiện định lượng + baseline + guardrails.
# ============================================================================

def build_recommendation_context(
    user_id: str,
    monthly_df: pd.DataFrame,
    transactions: pd.DataFrame,
    leaders: Dict[str, Any],
) -> dict:
    user_rows = monthly_df[monthly_df["userId"] == user_id].copy()
    if user_rows.empty:
        return {"error": f"Không tìm thấy user {user_id} trong monthly features"}

    latest = user_rows.sort_values("ym").iloc[-1]
    cluster_key = f"{int(latest['macro_cluster'])}:{int(latest['micro_cluster'])}"
    raw_leaders = leaders.get(cluster_key, [])
    leader_set = [x for x in raw_leaders if x.get("userId") != user_id] or raw_leaders

    forecast = forecast_month_end_expense(
        transactions=transactions,
        user_id=user_id,
        ym=str(latest["ym"]),
    )
    predicted_eom = float(forecast["predicted_expense_eom"])
    current_expense = float(latest["expense"])
    overrun = max(0.0, predicted_eom - float(latest["income"]))

    top_spend_cat = None
    top_spend_share = -1.0
    for col, value in latest.items():
        if isinstance(col, str) and col.startswith("cat_share_") and float(value) > top_spend_share:
            top_spend_share = float(value)
            top_spend_cat = normalize_vi_text(col.replace("cat_share_", ""))

    normalized_leaders = []
    for leader in leader_set:
        dist = leader.get("category_distribution", {})
        normalized_leaders.append(
            {
                **leader,
                "category_distribution": {
                    normalize_vi_text(k): float(v) for k, v in dist.items()
                },
            },
        )

    return {
        "user_id": user_id,
        "period": str(latest["ym"]),
        "cluster": {
            "macro": int(latest["macro_cluster"]),
            "micro": int(latest["micro_cluster"]),
        },
        "metrics": {
            "income": float(latest["income"]),
            "expense_so_far": current_expense,
            "expense_to_income_ratio": float(latest["expense_to_income_ratio"]),
            "anomaly_count": int(latest["anomaly_count"]),
            "goal_completion_rate": float(latest["goal_completion_rate"]),
            "predicted_expense_end_month": predicted_eom,
            "predicted_overrun_vs_income": overrun,
            "top_spend_category": top_spend_cat,
            "top_spend_category_share": top_spend_share,
        },
        "leader_baseline": normalized_leaders,
        "system_guidance": {
            "rule": "Không tạo số liệu ngoài context. Đưa ra gợi ý hành động cụ thể.",
            "suggestion_seed": [
                "Nếu dự báo thâm hụt, ưu tiên cắt 10-20% danh mục có tỷ trọng lớn nhất.",
                "Đối chiếu với user hình mẫu cùng cụm để đề xuất tỷ lệ chi hợp lý.",
                "Nếu anomaly_count cao, cảnh báo và gợi ý duyệt lại giao dịch lớn bất thường.",
            ],
        },
        "forecast_debug": forecast,
    }


# ============================================================================
# [PHẦN 9] I/O ARTIFACTS
# ----------------------------------------------------------------------------
# Mục đích:
# - Chuẩn hóa nơi ghi/đọc model output.
# ============================================================================

def save_training_artifacts(
    cfg: ModelConfig,
    clustered_df: pd.DataFrame,
    cluster_artifacts: ClusterArtifacts,
    leaders: dict,
    report: dict,
) -> dict:
    cfg.artifacts_dir.mkdir(parents=True, exist_ok=True)

    monthly_path = cfg.artifacts_dir / "monthly_features.csv"
    model_path = cfg.artifacts_dir / "model.pkl"
    leaders_path = cfg.artifacts_dir / "leaders.json"
    report_path = cfg.artifacts_dir / "cluster_report.json"

    clustered_df.to_csv(monthly_path, index=False)
    with open(model_path, "wb") as f:
        pickle.dump(cluster_artifacts, f)
    with open(leaders_path, "w", encoding="utf-8") as f:
        json.dump(leaders, f, ensure_ascii=False, indent=2)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    return {
        "monthly_features": str(monthly_path),
        "model": str(model_path),
        "leaders": str(leaders_path),
        "cluster_report": str(report_path),
    }


# ============================================================================
# [PHẦN 9.1] VẼ CHART / BẢNG RA ẢNH (DÙNG CHO COLAB / REPORT)
# ----------------------------------------------------------------------------
# Mục đích:
# - Xuất nhanh các biểu đồ PNG để kiểm tra dữ liệu và trình bày báo cáo.
# ============================================================================

def _save_table_png(df: pd.DataFrame, title: str, out_path: Path):
    plt.figure(figsize=(max(8, min(16, len(df.columns) * 1.5)), max(2.5, min(10, len(df) * 0.45 + 1.5))))
    plt.axis("off")
    plt.title(title, fontsize=12, fontweight="bold", pad=12)
    table = plt.table(
        cellText=df.values,
        colLabels=df.columns,
        loc="center",
        cellLoc="center",
    )
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1, 1.25)
    plt.tight_layout()
    plt.savefig(out_path, dpi=180, bbox_inches="tight")
    plt.close()


def export_training_visuals(clustered_df: pd.DataFrame, leaders: dict, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    sns.set_theme(style="whitegrid")

    # 1) Phân phối record theo macro/micro cluster
    cluster_counts = (
        clustered_df.groupby(["macro_cluster", "micro_cluster"], as_index=False)
        .size()
        .rename(columns={"size": "records"})
    )
    plt.figure(figsize=(10, 5))
    sns.barplot(
        data=cluster_counts,
        x="macro_cluster",
        y="records",
        hue="micro_cluster",
        palette="viridis",
    )
    plt.title("So luong user-thang theo macro/micro cluster")
    plt.xlabel("Macro cluster")
    plt.ylabel("Records")
    plt.tight_layout()
    plt.savefig(out_dir / "01_cluster_distribution.png", dpi=180)
    plt.close()

    # 2) Heatmap tỷ trọng category trung bình theo macro cluster
    share_cols = [c for c in clustered_df.columns if c.startswith("cat_share_")]
    if share_cols:
        heatmap_df = (
            clustered_df.groupby("macro_cluster")[share_cols]
            .mean()
            .rename(columns=lambda c: c.replace("cat_share_", ""))
        )
        plt.figure(figsize=(11, 4))
        sns.heatmap(heatmap_df, annot=True, fmt=".2f", cmap="YlGnBu")
        plt.title("Ty trong chi tieu trung binh theo category va macro cluster")
        plt.xlabel("Category")
        plt.ylabel("Macro cluster")
        plt.tight_layout()
        plt.savefig(out_dir / "02_category_share_heatmap.png", dpi=180)
        plt.close()

    # 3) Quan hệ income vs expense ratio (màu theo macro cluster)
    plt.figure(figsize=(9, 6))
    sns.scatterplot(
        data=clustered_df,
        x="month_income_feature",
        y="expense_to_income_ratio",
        hue="macro_cluster",
        style="micro_cluster",
        alpha=0.8,
        palette="tab10",
    )
    plt.title("Income vs Expense/Income ratio")
    plt.xlabel("Month income feature")
    plt.ylabel("Expense to income ratio")
    plt.tight_layout()
    plt.savefig(out_dir / "03_income_vs_ratio_scatter.png", dpi=180)
    plt.close()

    # 4) Anomaly trung bình theo cụm
    anomaly_df = (
        clustered_df.groupby(["macro_cluster", "micro_cluster"], as_index=False)["anomaly_count"]
        .mean()
        .rename(columns={"anomaly_count": "avg_anomaly"})
    )
    plt.figure(figsize=(10, 5))
    sns.barplot(
        data=anomaly_df,
        x="macro_cluster",
        y="avg_anomaly",
        hue="micro_cluster",
        palette="magma",
    )
    plt.title("Anomaly trung binh theo macro/micro cluster")
    plt.xlabel("Macro cluster")
    plt.ylabel("Average anomaly count")
    plt.tight_layout()
    plt.savefig(out_dir / "04_avg_anomaly_by_cluster.png", dpi=180)
    plt.close()

    # 5) Bảng top leaders
    leader_rows: list[dict] = []
    for cluster_key, items in leaders.items():
        for rank, row in enumerate(items, start=1):
            leader_rows.append(
                {
                    "cluster": cluster_key,
                    "rank": rank,
                    "userId": row.get("userId"),
                    "ym": row.get("ym"),
                    "leader_score": round(float(row.get("leader_score", 0)), 4),
                    "expense_to_income_ratio": round(float(row.get("expense_to_income_ratio", 0)), 4),
                    "goal_completion_rate": round(float(row.get("goal_completion_rate", 0)), 4),
                    "anomaly_count": int(row.get("anomaly_count", 0)),
                }
            )
    if leader_rows:
        leader_df = pd.DataFrame(leader_rows).sort_values(["cluster", "rank"]).head(40)
        _save_table_png(
            leader_df,
            "Top leader baseline theo cluster",
            out_dir / "05_leader_table.png",
        )

    # 6) Bảng thống kê nhanh theo user
    user_table = (
        clustered_df.groupby("userId", as_index=False)
        .agg(
            months=("ym", "nunique"),
            avg_income=("month_income_feature", "mean"),
            avg_expense_ratio=("expense_to_income_ratio", "mean"),
            avg_anomaly=("anomaly_count", "mean"),
        )
        .sort_values("months", ascending=False)
        .head(30)
    )
    user_table["avg_income"] = user_table["avg_income"].round(0)
    user_table["avg_expense_ratio"] = user_table["avg_expense_ratio"].round(3)
    user_table["avg_anomaly"] = user_table["avg_anomaly"].round(3)
    _save_table_png(
        user_table,
        "Thong ke nhanh theo user",
        out_dir / "06_user_summary_table.png",
    )


# ============================================================================
# [PHẦN 10] ORCHESTRATION - TRAIN
# ----------------------------------------------------------------------------
# Mục đích:
# - Chạy toàn bộ pipeline huấn luyện từ đầu tới cuối.
# ============================================================================

def run_train(
    mongo_uri: str,
    database: str,
    macro_k: int,
    micro_k: int,
    export_viz: bool = False,
) -> dict:
    cfg = ModelConfig(database=database, macro_k=macro_k, micro_k=micro_k)

    data = load_collections(mongo_uri, cfg.database)
    monthly = build_monthly_features(
        users=data["users"],
        goals=data["goals"],
        transactions=data["transactions"],
    )
    clustered, model_artifacts = train_two_level_clustering(
        monthly,
        macro_k=cfg.macro_k,
        micro_k=cfg.micro_k,
        random_state=cfg.random_state,
    )
    leaders = build_leaders(clustered)
    report = summarize_clusters(clustered)
    paths = save_training_artifacts(cfg, clustered, model_artifacts, leaders, report)
    viz_dir = cfg.artifacts_dir / "viz"
    if export_viz:
        export_training_visuals(clustered, leaders, viz_dir)

    result = {
        "records": int(len(clustered)),
        "artifacts_dir": str(cfg.artifacts_dir),
        "files": paths,
    }
    if export_viz:
        result["viz_dir"] = str(viz_dir)
    return result


# ============================================================================
# [PHẦN 11] ORCHESTRATION - RECOMMEND
# ----------------------------------------------------------------------------
# Mục đích:
# - Tạo context gợi ý cho một user dựa trên artifacts đã train.
# ============================================================================

def run_recommend(
    mongo_uri: str,
    user_id: str,
    database: str,
    features_csv: str | None = None,
    leaders_json: str | None = None,
) -> dict:
    cfg = ModelConfig(database=database)
    cfg.artifacts_dir.mkdir(parents=True, exist_ok=True)

    features_path = Path(features_csv) if features_csv else cfg.artifacts_dir / "monthly_features.csv"
    leaders_path = Path(leaders_json) if leaders_json else cfg.artifacts_dir / "leaders.json"

    monthly_df = pd.read_csv(features_path)
    with open(leaders_path, "r", encoding="utf-8") as f:
        leaders = json.load(f)

    data = load_collections(mongo_uri, database)
    context = build_recommendation_context(
        user_id=user_id,
        monthly_df=monthly_df,
        transactions=data["transactions"],
        leaders=leaders,
    )

    out_path = cfg.artifacts_dir / f"recommendation_{user_id}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(context, f, ensure_ascii=False, indent=2)

    return {"output": str(out_path)}


# ============================================================================
# [PHẦN 12] CLI ENTRYPOINT
# ----------------------------------------------------------------------------
# Mục đích:
# - Cung cấp command-line thống nhất cho cả train/recommend.
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="All-in-one AI recommender pipeline (train + recommend)",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    train_cmd = sub.add_parser("train", help="Chạy toàn bộ training pipeline")
    train_cmd.add_argument("--mongo-uri", required=True)
    train_cmd.add_argument("--database", default=ModelConfig.database)
    train_cmd.add_argument("--macro-k", type=int, default=ModelConfig.macro_k)
    train_cmd.add_argument("--micro-k", type=int, default=ModelConfig.micro_k)
    train_cmd.add_argument(
        "--export-viz",
        action="store_true",
        help="Xuat chart + bang PNG vao artifacts/viz",
    )

    rec_cmd = sub.add_parser("recommend", help="Sinh recommendation context cho 1 user")
    rec_cmd.add_argument("--mongo-uri", required=True)
    rec_cmd.add_argument("--user-id", required=True)
    rec_cmd.add_argument("--database", default=ModelConfig.database)
    rec_cmd.add_argument("--features-csv")
    rec_cmd.add_argument("--leaders-json")

    args = parser.parse_args()

    if args.command == "train":
        result = run_train(
            mongo_uri=args.mongo_uri,
            database=args.database,
            macro_k=args.macro_k,
            micro_k=args.micro_k,
            export_viz=args.export_viz,
        )
    else:
        result = run_recommend(
            mongo_uri=args.mongo_uri,
            user_id=args.user_id,
            database=args.database,
            features_csv=args.features_csv,
            leaders_json=args.leaders_json,
        )

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
