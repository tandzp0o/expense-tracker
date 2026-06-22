from __future__ import annotations

from typing import Dict

import pandas as pd
from pymongo import MongoClient


def _to_df(docs):
    if not docs:
        return pd.DataFrame()
    return pd.DataFrame(docs)


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

