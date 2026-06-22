from __future__ import annotations


MOJIBAKE_MAP = {
    "Ä‚n uá»‘ng": "Ăn uống",
    "Di chuyá»ƒn": "Di chuyển",
    "Mua sáº¯m": "Mua sắm",
    "Giáº£i trÃ­": "Giải trí",
    "Sá»©c khá»e": "Sức khỏe",
    "GiÃ¡o dá»¥c": "Giáo dục",
    "HÃ³a Ä‘Æ¡n": "Hóa đơn",
    "KhÃ¡c": "Khác",
    "KhÃ´ng táº¡o sá»‘ liá»‡u ngoÃ i context. ÄÆ°a ra gá»£i Ã½ hÃ nh Ä‘á»™ng cá»¥ thá»ƒ.": "Không tạo số liệu ngoài context. Đưa ra gợi ý hành động cụ thể.",
}

CATEGORY_ALIAS_MAP = {
    "dịch vụ, mua sắm": "Mua sắm",
    "dich vu, mua sam": "Mua sắm",
    "mua sắm": "Mua sắm",
    "mua sam": "Mua sắm",
    "lặt vặt": "Khác",
    "lat vat": "Khác",
    "chăm vợ": "Giải trí",
    "cham vo": "Giải trí",
    "ăn uống": "Ăn uống",
    "an uong": "Ăn uống",
    "di chuyển": "Di chuyển",
    "di chuyen": "Di chuyển",
    "giải trí": "Giải trí",
    "giai tri": "Giải trí",
    "sức khỏe": "Sức khỏe",
    "suc khoe": "Sức khỏe",
    "giáo dục": "Giáo dục",
    "giao duc": "Giáo dục",
    "hóa đơn": "Hóa đơn",
    "hoa don": "Hóa đơn",
    "khác": "Khác",
    "khac": "Khác",
}


def normalize_vi_text(value: str) -> str:
    if not isinstance(value, str):
        return value
    if value in MOJIBAKE_MAP:
        return MOJIBAKE_MAP[value]

    # Heuristic fix for mojibake strings like "Ä‚n uá»‘ng"
    try:
        repaired = value.encode("latin1").decode("utf-8")
        if repaired:
            value = repaired
    except Exception:
        pass

    return MOJIBAKE_MAP.get(value, value)


def normalize_category(value: str) -> str:
    text = normalize_vi_text(value or "")
    key = text.strip().lower()
    return CATEGORY_ALIAS_MAP.get(key, text)
