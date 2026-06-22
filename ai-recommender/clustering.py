from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


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

    macro_x = df[["month_income_feature", "target_saving_ratio"]].astype(float)
    macro_scaler = StandardScaler()
    macro_xs = macro_scaler.fit_transform(macro_x)
    macro_model = KMeans(n_clusters=macro_k, n_init=20, random_state=random_state)
    df["macro_cluster"] = macro_model.fit_predict(macro_xs)

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
        x = g[micro_cols].astype(float)
        scaler = StandardScaler()
        xs = scaler.fit_transform(x)
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
    report = {
        "records": int(len(df)),
        "macro": {},
    }
    for macro_id, mg in df.groupby("macro_cluster"):
        macro_key = str(int(macro_id))
        report["macro"][macro_key] = {
            "size": int(len(mg)),
            "avg_income": float(np.mean(mg["month_income_feature"])),
            "avg_expense_income_ratio": float(np.mean(mg["expense_to_income_ratio"])),
            "micro": {},
        }
        for micro_id, sg in mg.groupby("micro_cluster"):
            report["macro"][macro_key]["micro"][str(int(micro_id))] = {
                "size": int(len(sg)),
                "avg_anomaly": float(np.mean(sg["anomaly_count"])),
                "avg_goal_completion": float(np.mean(sg["goal_completion_rate"])),
            }
    return report

