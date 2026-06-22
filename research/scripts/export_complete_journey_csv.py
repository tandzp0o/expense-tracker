from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
LOCAL_PYTHON = REPO_ROOT / "research" / ".python"
if LOCAL_PYTHON.exists():
    sys.path.insert(0, str(LOCAL_PYTHON))

import pandas as pd
import pyreadr


RAW_DIR = REPO_ROOT / "research" / "datasets" / "complete-journey" / "raw"
CSV_DIR = REPO_ROOT / "research" / "datasets" / "complete-journey" / "processed" / "csv"


def read_r_objects(path: Path) -> dict[Any, pd.DataFrame]:
    result = pyreadr.read_r(str(path))
    if not result:
        raise ValueError(f"Không đọc được dữ liệu từ {path}")
    return dict(result)


def csv_name_for(path: Path, object_name: Any, object_count: int) -> str:
    if object_count == 1:
        return f"{path.stem}.csv"

    safe_name = str(object_name or "data").replace("/", "_").replace("\\", "_")
    return f"{path.stem}__{safe_name}.csv"


def export_file(path: Path, output_dir: Path, overwrite: bool) -> list[dict[str, Any]]:
    outputs: list[dict[str, Any]] = []
    objects = read_r_objects(path)

    for object_name, frame in objects.items():
        csv_path = output_dir / csv_name_for(path, object_name, len(objects))
        if csv_path.exists() and not overwrite:
            outputs.append(
                {
                    "source": str(path),
                    "object": object_name,
                    "csv": str(csv_path),
                    "rows": int(frame.shape[0]),
                    "columns": int(frame.shape[1]),
                    "skipped": True,
                }
            )
            continue

        # utf-8-sig giúp Excel trên Windows nhận đúng encoding và vẫn giữ header row.
        frame.to_csv(csv_path, index=False, header=True, encoding="utf-8-sig")
        outputs.append(
            {
                "source": str(path),
                "object": object_name,
                "csv": str(csv_path),
                "rows": int(frame.shape[0]),
                "columns": int(frame.shape[1]),
                "skipped": False,
            }
        )

    return outputs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export Complete Journey .rds/.rda files to CSV files with header rows."
    )
    parser.add_argument(
        "--files",
        nargs="*",
        default=[],
        help="Tên file trong raw dir. Bỏ trống để export toàn bộ .rds/.rda.",
    )
    parser.add_argument("--output-dir", default=str(CSV_DIR))
    parser.add_argument("--no-overwrite", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.files:
        files = [RAW_DIR / name for name in args.files]
    else:
        files = sorted([*RAW_DIR.glob("*.rda"), *RAW_DIR.glob("*.rds")])

    if not files:
        raise FileNotFoundError(f"Không tìm thấy file .rds/.rda trong {RAW_DIR}")

    summary: list[dict[str, Any]] = []
    for path in files:
        if not path.exists():
            raise FileNotFoundError(path)
        print(f"Exporting {path.name}...")
        summary.extend(export_file(path, output_dir, overwrite=not args.no_overwrite))

    manifest_path = output_dir / "CSV_MANIFEST.json"
    manifest_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )

    print(json.dumps(summary, ensure_ascii=False, indent=2, default=str))
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
