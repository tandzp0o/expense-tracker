from __future__ import annotations

from typing import List

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from config import EXPENSE_CATEGORIES
from text_normalize import normalize_category, normalize_vi_text


def _safe_div(a: float, b: float) -> float:
    if b == 0:
        return 0.0
    return float(a) / float(b)


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

    # Category distribution
    expense_tx = tx[tx["type"] == "EXPENSE"].copy()
    cat = (
        expense_tx.groupby(["userId", "ym", "category"], as_index=False)["amount"].sum()
    )
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

    cat_pivot = cat_pivot[EXPENSE_CATEGORIES]
    cat_pivot = cat_pivot.reset_index()
    cat_sum = cat_pivot[EXPENSE_CATEGORIES].sum(axis=1).replace(0, np.nan)
    for c in EXPENSE_CATEGORIES:
        cat_pivot[f"cat_share_{c}"] = (cat_pivot[c] / cat_sum).fillna(0.0)
    cat_pivot = cat_pivot.drop(columns=EXPENSE_CATEGORIES)

    base = base.merge(cat_pivot, on=["userId", "ym"], how="left").fillna(0)

    # Anomaly count by user-month using Isolation Forest on expense transactions per user
    anomaly_frames: List[pd.DataFrame] = []
    for uid, g in expense_tx.groupby("userId"):
        if len(g) < 15:
            tmp = g[["userId", "ym"]].copy()
            tmp["is_anomaly"] = 0
            anomaly_frames.append(tmp)
            continue
        model = IsolationForest(
            n_estimators=120,
            contamination=0.08,
            random_state=42,
        )
        x = g[["amount"]].astype(float).values
        pred = model.fit_predict(x)
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

    # Goal features
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
