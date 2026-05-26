import os
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "firsthand.db")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_db()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS incidents (
                id TEXT PRIMARY KEY,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                severity TEXT NOT NULL,
                victim_count INTEGER NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS bystanders (
                id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                name TEXT NOT NULL,
                skill TEXT NOT NULL,
                committed INTEGER NOT NULL,
                role TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS triage_answers (
                id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                conscious TEXT NOT NULL,
                breathing TEXT NOT NULL,
                bleeding TEXT NOT NULL,
                moving TEXT NOT NULL,
                severity TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_bystanders_incident_id ON bystanders(incident_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_triage_incident_id ON triage_answers(incident_id)")
        conn.commit()
    finally:
        conn.close()


def insert_incident(
    incident_id: str,
    lat: float,
    lng: float,
    victim_count: int = 1,
    status: str = "active",
    severity: str = "UNKNOWN",
) -> Dict[str, Any]:
    created_at = _now_iso()
    conn = get_db()
    try:
        conn.execute(
            """
            INSERT INTO incidents (id, lat, lng, severity, victim_count, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (incident_id, lat, lng, severity, victim_count, status, created_at),
        )
        conn.commit()
    finally:
        conn.close()
    return {
        "id": incident_id,
        "lat": lat,
        "lng": lng,
        "severity": severity,
        "victim_count": victim_count,
        "status": status,
        "created_at": created_at,
    }


def insert_bystander(
    bystander_id: str,
    incident_id: str,
    name: str,
    skill: str,
    committed: int,
    role: str,
) -> Dict[str, Any]:
    created_at = _now_iso()
    conn = get_db()
    try:
        conn.execute(
            """
            INSERT INTO bystanders (id, incident_id, name, skill, committed, role, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (bystander_id, incident_id, name, skill, committed, role, created_at),
        )
        conn.commit()
    finally:
        conn.close()
    return {
        "id": bystander_id,
        "incident_id": incident_id,
        "name": name,
        "skill": skill,
        "committed": committed,
        "role": role,
        "created_at": created_at,
    }


def insert_triage(
    triage_id: str,
    incident_id: str,
    conscious: str,
    breathing: str,
    bleeding: str,
    moving: str,
    severity: str,
) -> Dict[str, Any]:
    created_at = _now_iso()
    conn = get_db()
    try:
        conn.execute(
            """
            INSERT INTO triage_answers (
                id, incident_id, conscious, breathing, bleeding, moving, severity, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (triage_id, incident_id, conscious, breathing, bleeding, moving, severity, created_at),
        )
        conn.commit()
    finally:
        conn.close()
    return {
        "id": triage_id,
        "incident_id": incident_id,
        "conscious": conscious,
        "breathing": breathing,
        "bleeding": bleeding,
        "moving": moving,
        "severity": severity,
        "created_at": created_at,
    }


def get_incident(incident_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,)).fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        conn.close()


def get_bystanders_for_incident(incident_id: str) -> List[Dict[str, Any]]:
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM bystanders WHERE incident_id = ? ORDER BY created_at ASC",
            (incident_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_triage_for_incident(incident_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM triage_answers WHERE incident_id = ? ORDER BY created_at DESC LIMIT 1",
            (incident_id,),
        ).fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        conn.close()


def update_incident_severity(incident_id: str, severity: str) -> None:
    conn = get_db()
    try:
        conn.execute("UPDATE incidents SET severity = ? WHERE id = ?", (severity, incident_id))
        conn.commit()
    finally:
        conn.close()

