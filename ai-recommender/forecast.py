from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression


def forecast_month_end_expense(transactions: pd.DataFrame, user_id: str, ym: str) -> dict:
    tx = transactions.copy()
    tx["date"] = pd.to_datetime(tx["date"], errors="coerce")
    tx = tx.dropna(subset=["date"])
    tx["ym"] = tx["date"].dt.to_period("M").astype(str)

    mtx = tx[
        (tx["userId"] == user_id)
        & (tx["ym"] == ym)
        & (tx["type"] == "EXPENSE")
    ].copy()

    if mtx.empty:
        return {"predicted_expense_eom": 0.0, "observed_so_far": 0.0, "method": "empty"}

    mtx["day"] = mtx["date"].dt.day
    daily = mtx.groupby("day", as_index=False)["amount"].sum().sort_values("day")
    daily["cum_expense"] = daily["amount"].cumsum()
    observed = float(daily["cum_expense"].iloc[-1])
    last_day_seen = int(daily["day"].iloc[-1])
    month_end = int(mtx["date"].dt.days_in_month.iloc[0])

    if len(daily) >= 4:
        x = daily[["day"]].values
        y = daily["cum_expense"].values
        model = LinearRegression()
        model.fit(x, y)
        pred = float(model.predict(np.array([[month_end]])).item())
        pred = max(pred, observed)
        return {"predicted_expense_eom": pred, "observed_so_far": observed, "method": "linear_regression", "last_day_seen": last_day_seen}

    avg_per_day = observed / max(last_day_seen, 1)
    pred = avg_per_day * month_end
    return {"predicted_expense_eom": float(pred), "observed_so_far": observed, "method": "moving_average", "last_day_seen": last_day_seen}

