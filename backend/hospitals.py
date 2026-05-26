import json
import os
from typing import Any, Dict, List, Optional

from geopy.distance import geodesic


DEFAULT_PATH = os.path.join(os.path.dirname(__file__), "data", "hospitals.json")


def _load_hospitals(path: str) -> List[Dict[str, Any]]:
    if not os.path.isfile(path):
        raise FileNotFoundError(f"hospitals.json not found at {path}")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("hospitals.json must be a list")
    return data


def _drive_time_min(distance_km: float) -> int:
    if distance_km <= 3:
        speed_kmh = 22
    elif distance_km <= 10:
        speed_kmh = 28
    elif distance_km <= 40:
        speed_kmh = 38
    else:
        speed_kmh = 50
    minutes = (distance_km / max(speed_kmh, 1)) * 60.0
    return max(6, int(round(minutes)))


def get_hospitals(
    lat: float,
    lng: float,
    severity: str,
    path: Optional[str] = None,
) -> List[Dict[str, Any]]:
    hosp_path = path or DEFAULT_PATH
    hospitals = _load_hospitals(hosp_path)

    def eligible(h: Dict[str, Any]) -> bool:
        if severity == "CRITICAL":
            return bool(h.get("has_icu")) and bool(h.get("has_blood_bank")) and bool(h.get("is_trauma_centre"))
        if severity == "SERIOUS":
            return bool(h.get("has_surgery") or h.get("has_icu")) and bool(h.get("is_trauma_centre"))
        return True

    filtered = [h for h in hospitals if eligible(h)]
    if severity == "CRITICAL" and len(filtered) < 5:
        # Relax slightly to guarantee results while still enforcing ICU + blood bank.
        filtered = [h for h in hospitals if bool(h.get("has_icu")) and bool(h.get("has_blood_bank"))]

    results: List[Dict[str, Any]] = []
    origin = (lat, lng)
    for h in filtered:
        hlat = float(h["lat"])
        hlng = float(h["lng"])
        distance_km = float(geodesic(origin, (hlat, hlng)).km)
        if distance_km <= 50.0:
            results.append(
                {
                    **h,
                    "distance_km": round(distance_km, 2),
                    "drive_time_min": _drive_time_min(distance_km),
                }
            )

    results.sort(key=lambda x: x.get("distance_km", 10**9))
    return results[:5]

