from __future__ import annotations

import pandas as pd


def build_leaders(clustered_df: pd.DataFrame) -> dict:
    leaders = {}
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

