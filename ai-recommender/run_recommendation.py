from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandas as pd

from config import ModelConfig
from mongo_io import load_collections
from recommender import build_recommendation_context


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mongo-uri", required=True)
    parser.add_argument("--user-id", required=True)
    parser.add_argument("--database", default=ModelConfig.database)
    parser.add_argument("--features-csv", default=str(ModelConfig.artifacts_dir / "monthly_features.csv"))
    parser.add_argument("--leaders-json", default=str(ModelConfig.artifacts_dir / "leaders.json"))
    args = parser.parse_args()

    monthly_df = pd.read_csv(args.features_csv)
    with open(args.leaders_json, "r", encoding="utf-8") as f:
        leaders = json.load(f)

    data = load_collections(args.mongo_uri, args.database)
    context = build_recommendation_context(
        user_id=args.user_id,
        monthly_df=monthly_df,
        transactions=data["transactions"],
        leaders=leaders,
    )

    out_dir = Path(ModelConfig.artifacts_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"recommendation_{args.user_id}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(context, f, ensure_ascii=False, indent=2)
    print(json.dumps({"output": str(out_path)}, ensure_ascii=False))


if __name__ == "__main__":
    main()

