from __future__ import annotations

from typing import Any, Dict

import pandas as pd

from forecast import forecast_month_end_expense
from text_normalize import normalize_vi_text


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
    key = f"{int(latest['macro_cluster'])}:{int(latest['micro_cluster'])}"
    raw_leaders = leaders.get(key, [])
    leader_set = [x for x in raw_leaders if x.get("userId") != user_id]
    if not leader_set:
        # fallback: giu leader cu thay vi de trong, nhung van canh bao cho layer LLM
        leader_set = raw_leaders

    forecast = forecast_month_end_expense(transactions, user_id=user_id, ym=str(latest["ym"]))
    predicted_eom = float(forecast["predicted_expense_eom"])
    current_expense = float(latest["expense"])
    overrun = max(0.0, predicted_eom - float(latest["income"]))

    top_spend_cat = None
    top_spend_share = -1.0
    for col, value in latest.items():
        if isinstance(col, str) and col.startswith("cat_share_"):
            if float(value) > top_spend_share:
                top_spend_share = float(value)
                top_spend_cat = normalize_vi_text(col.replace("cat_share_", ""))

    normalized_leaders = []
    for leader in leader_set:
        dist = leader.get("category_distribution", {})
        dist_norm = {normalize_vi_text(k): float(v) for k, v in dist.items()}
        item = dict(leader)
        item["category_distribution"] = dist_norm
        normalized_leaders.append(item)

    return {
        "user_id": user_id,
        "period": str(latest["ym"]),
        "cluster": {"macro": int(latest["macro_cluster"]), "micro": int(latest["micro_cluster"])},
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
