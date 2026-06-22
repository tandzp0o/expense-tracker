from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


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

