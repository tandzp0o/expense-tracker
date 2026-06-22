from __future__ import annotations

import argparse
import json
import pickle

from clustering import summarize_clusters, train_two_level_clustering
from config import ModelConfig
from feature_pipeline import build_monthly_features
from leaderboard import build_leaders
from mongo_io import load_collections


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mongo-uri", required=True)
    parser.add_argument("--database", default=ModelConfig.database)
    parser.add_argument("--macro-k", type=int, default=ModelConfig.macro_k)
    parser.add_argument("--micro-k", type=int, default=ModelConfig.micro_k)
    args = parser.parse_args()

    cfg = ModelConfig(database=args.database, macro_k=args.macro_k, micro_k=args.micro_k)
    cfg.artifacts_dir.mkdir(parents=True, exist_ok=True)

    data = load_collections(args.mongo_uri, cfg.database)
    monthly = build_monthly_features(
        users=data["users"],
        goals=data["goals"],
        transactions=data["transactions"],
    )
    clustered, model = train_two_level_clustering(
        monthly,
        macro_k=cfg.macro_k,
        micro_k=cfg.micro_k,
        random_state=cfg.random_state,
    )
    leaders = build_leaders(clustered)
    report = summarize_clusters(clustered)

    monthly_path = cfg.artifacts_dir / "monthly_features.csv"
    model_path = cfg.artifacts_dir / "model.pkl"
    leaders_path = cfg.artifacts_dir / "leaders.json"
    report_path = cfg.artifacts_dir / "cluster_report.json"

    clustered.to_csv(monthly_path, index=False)
    with open(model_path, "wb") as f:
        pickle.dump(model, f)
    with open(leaders_path, "w", encoding="utf-8") as f:
        json.dump(leaders, f, ensure_ascii=False, indent=2)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(json.dumps({"records": len(clustered), "artifacts_dir": str(cfg.artifacts_dir)}, ensure_ascii=False))


if __name__ == "__main__":
    main()

