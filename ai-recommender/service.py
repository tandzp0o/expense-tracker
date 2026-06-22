from __future__ import annotations

import json
import os
from pathlib import Path
from threading import Lock
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel
from pymongo import MongoClient

from ai_recommender_all_in_one import ModelConfig, run_recommend, run_train


app = FastAPI(title="Expense Tracker AI Recommender")

train_lock = Lock()
is_training = False
last_train_at: str | None = None
last_train_error: str | None = None


class TrainRequest(BaseModel):
    database: str = ModelConfig.database
    macro_k: int = ModelConfig.macro_k
    micro_k: int = ModelConfig.micro_k
    export_viz: bool = True


class RecommendRequest(BaseModel):
    user_id: str
    database: str = ModelConfig.database


def require_service_key(x_ai_service_key: str | None = Header(default=None)) -> None:
    expected = os.getenv("AI_SERVICE_KEY")
    if expected and x_ai_service_key != expected:
        raise HTTPException(status_code=401, detail="Invalid AI service key")


def get_mongo_uri() -> str:
    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        raise HTTPException(status_code=500, detail="MONGO_URI is missing")
    return mongo_uri


def read_json(path: Path) -> Any | None:
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def build_status() -> dict[str, Any]:
    artifacts_dir = ModelConfig.artifacts_dir
    cluster_report_path = artifacts_dir / "cluster_report.json"
    monthly_path = artifacts_dir / "monthly_features.csv"

    return {
        "isTraining": is_training,
        "lastTrainAt": last_train_at,
        "lastTrainError": last_train_error,
        "hasArtifacts": monthly_path.exists() or cluster_report_path.exists(),
        "clusterReport": read_json(cluster_report_path),
    }


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "ai-recommender"}


@app.get("/status", dependencies=[Depends(require_service_key)])
def status() -> dict[str, Any]:
    return build_status()


@app.post("/train", dependencies=[Depends(require_service_key)])
def train(payload: TrainRequest) -> dict[str, Any]:
    global is_training, last_train_at, last_train_error

    if not train_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="AI model is already training")

    is_training = True
    last_train_error = None
    try:
        result = run_train(
            mongo_uri=get_mongo_uri(),
            database=payload.database,
            macro_k=payload.macro_k,
            micro_k=payload.micro_k,
            export_viz=payload.export_viz,
        )
        from datetime import datetime, timezone

        last_train_at = datetime.now(timezone.utc).isoformat()
        return {
            "message": "Train completed",
            "result": result,
            "status": build_status(),
        }
    except Exception as exc:
        last_train_error = str(exc)
        raise HTTPException(status_code=500, detail=last_train_error) from exc
    finally:
        is_training = False
        train_lock.release()


@app.get("/users", dependencies=[Depends(require_service_key)])
def users(database: str = ModelConfig.database) -> dict[str, Any]:
    client = MongoClient(get_mongo_uri())
    try:
        rows = list(
            client[database]["users"]
            .find(
                {},
                {
                    "_id": 0,
                    "uid": 1,
                    "email": 1,
                    "displayName": 1,
                    "totalIncome": 1,
                    "totalExpense": 1,
                    "updatedAt": 1,
                },
            )
            .sort("updatedAt", -1)
        )
        return {"data": rows}
    finally:
        client.close()


@app.post("/recommend", dependencies=[Depends(require_service_key)])
def recommend(payload: RecommendRequest) -> dict[str, Any]:
    if not payload.user_id.strip():
        raise HTTPException(status_code=400, detail="user_id is required")

    result = run_recommend(
        mongo_uri=get_mongo_uri(),
        user_id=payload.user_id.strip(),
        database=payload.database,
    )
    output_path = Path(result["output"])
    return {
        "outputPath": str(output_path),
        "recommendation": read_json(output_path),
    }
