from __future__ import annotations

from collections import Counter


def within_country_index(values: list[float | None]) -> list[float | None]:
    observed = [value for value in values if value is not None]
    if not observed:
        return [None for _ in values]
    low, high = min(observed), max(observed)
    if low == high:
        return [50.0 if value is not None else None for value in values]
    return [None if value is None else round((value - low) / (high - low) * 100, 2) for value in values]


def percentage_change(current: float | None, previous: float | None) -> float | None:
    if current is None or previous in (None, 0):
        return None
    return round((current - previous) / previous * 100, 2)


def outlet_hhi(outlets: list[str]) -> float | None:
    if not outlets:
        return None
    counts, total = Counter(outlets), len(outlets)
    return round(sum((count / total) ** 2 for count in counts.values()), 4)
