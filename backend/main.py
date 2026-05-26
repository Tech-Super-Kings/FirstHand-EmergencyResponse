import json
import os
import random
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import db
import hospitals
import sms
import triage


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _incident_id() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"INC-{ts}{random.randint(0, 9999):04d}"


def _bystander_id() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"BYS-{ts}{random.randint(0, 9999):04d}"


def _triage_id() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"TRI-{ts}{random.randint(0, 9999):04d}"


class TriggerRequest(BaseModel):
    lat: float
    lng: float
    victim_count: int = Field(default=1, ge=1, le=20)


class TriggerResponse(BaseModel):
    incident_id: str
    lat: float
    lng: float
    status: str
    created_at: str


Skill = Literal["first_aid", "medical", "none"]


class BystanderCommitRequest(BaseModel):
    incident_id: str
    name: str = Field(min_length=1, max_length=40)
    skill: Skill


class BystanderCommitResponse(BaseModel):
    bystander_id: str
    role: str
    message: str


Answer = Literal["yes", "no", "unsure"]


class TriageAnswers(BaseModel):
    conscious: Answer
    breathing: Answer
    bleeding: Answer
    moving: Answer


class TriageRequest(BaseModel):
    incident_id: str
    answers: TriageAnswers


class HandoffRequest(BaseModel):
    incident_id: str
    hospital_name: str
    hospital_phone: str


class SmsRequest(BaseModel):
    incident_id: str
    contacts: List[str]


class SimulateResponse(BaseModel):
    incident_id: str
    lat: float
    lng: float
    message: str


class IncidentConnectionManager:
    def __init__(self) -> None:
        self.active_connections: Dict[str, set[WebSocket]] = {}

    async def connect(self, incident_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.setdefault(incident_id, set()).add(websocket)

    def disconnect(self, incident_id: str, websocket: WebSocket) -> None:
        conns = self.active_connections.get(incident_id)
        if not conns:
            return
        conns.discard(websocket)
        if not conns:
            self.active_connections.pop(incident_id, None)

    async def broadcast(self, incident_id: str, message: Dict[str, Any], exclude: Optional[WebSocket] = None) -> None:
        conns = list(self.active_connections.get(incident_id, set()))
        for ws in conns:
            if exclude is not None and ws is exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                try:
                    await ws.close()
                except Exception:
                    pass
                self.disconnect(incident_id, ws)


app = FastAPI(title="FirstHand API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = IncidentConnectionManager()


@app.on_event("startup")
def _startup() -> None:
    db.init_db()


@app.post("/api/trigger", response_model=TriggerResponse)
def api_trigger(req: TriggerRequest) -> TriggerResponse:
    incident_id = _incident_id()
    created = db.insert_incident(incident_id, req.lat, req.lng, victim_count=req.victim_count, status="active")
    return TriggerResponse(
        incident_id=created["id"],
        lat=created["lat"],
        lng=created["lng"],
        status=created["status"],
        created_at=created["created_at"],
    )


@app.websocket("/ws/bystanders/{incident_id}")
async def ws_bystanders(websocket: WebSocket, incident_id: str) -> None:
    await manager.connect(incident_id, websocket)
    try:
        # Snapshot for newly connected client.
        snapshot = {
            "type": "bystander_joined",
            "incident_id": incident_id,
            "server_time": _now_iso(),
            "bystanders": db.get_bystanders_for_incident(incident_id),
            "triage": db.get_triage_for_incident(incident_id),
        }
        await websocket.send_json(snapshot)

        # Notify others.
        await manager.broadcast(
            incident_id,
            {"type": "bystander_joined", "incident_id": incident_id, "server_time": _now_iso()},
            exclude=websocket,
        )

        while True:
            message = await websocket.receive_json()
            if isinstance(message, dict):
                message.setdefault("server_time", _now_iso())
            await manager.broadcast(incident_id, message, exclude=websocket)
    except WebSocketDisconnect:
        manager.disconnect(incident_id, websocket)
    except Exception:
        manager.disconnect(incident_id, websocket)
        try:
            await websocket.close()
        except Exception:
            pass


@app.post("/api/bystander/commit", response_model=BystanderCommitResponse)
def api_bystander_commit(req: BystanderCommitRequest) -> BystanderCommitResponse:
    incident = db.get_incident(req.incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="incident not found")

    if req.skill == "first_aid":
        role = "Check airway. Apply firm pressure to bleeding. Do not move victim."
    elif req.skill == "medical":
        role = "Take charge. Direct other bystanders. Assess ABC urgently."
    else:
        role = "Keep crowd 10m back. Flag ambulance. Relay information."

    bystander_id = _bystander_id()
    row = db.insert_bystander(
        bystander_id=bystander_id,
        incident_id=req.incident_id,
        name=req.name.strip(),
        skill=req.skill,
        committed=1,
        role=role,
    )

    # Best-effort broadcast (HTTP route -> WS clients).
    try:
        import anyio

        anyio.from_thread.run(
            manager.broadcast,
            req.incident_id,
            {
                "type": "bystander_committed",
                "incident_id": req.incident_id,
                "bystander": row,
                "server_time": _now_iso(),
            },
            None,
        )
    except Exception:
        pass

    return BystanderCommitResponse(bystander_id=bystander_id, role=role, message="You are now a first responder.")


@app.post("/api/triage")
def api_triage(req: TriageRequest) -> Dict[str, Any]:
    incident = db.get_incident(req.incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="incident not found")

    answers = req.answers.dict()
    result = triage.classify_severity(answers)

    db.update_incident_severity(req.incident_id, result["severity"])
    triage_row = db.insert_triage(
        triage_id=_triage_id(),
        incident_id=req.incident_id,
        conscious=answers["conscious"],
        breathing=answers["breathing"],
        bleeding=answers["bleeding"],
        moving=answers["moving"],
        severity=result["severity"],
    )

    # Broadcast triage update.
    try:
        import anyio

        anyio.from_thread.run(
            manager.broadcast,
            req.incident_id,
            {
                "type": "triage_update",
                "incident_id": req.incident_id,
                "triage": {**triage_row, **result},
                "server_time": _now_iso(),
            },
            None,
        )
    except Exception:
        pass

    return result


@app.get("/api/hospitals")
def api_hospitals(lat: float, lng: float, severity: str = "UNKNOWN") -> List[Dict[str, Any]]:
    sev = severity.upper()
    try:
        return hospitals.get_hospitals(lat=float(lat), lng=float(lng), severity=sev)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/handoff")
def api_handoff(req: HandoffRequest) -> Dict[str, Any]:
    incident = db.get_incident(req.incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="incident not found")

    triage_row = db.get_triage_for_incident(req.incident_id)
    bystanders = db.get_bystanders_for_incident(req.incident_id)
    note = triage.generate_handoff_note(
        incident,
        triage_row,
        bystanders,
        hospital_name=req.hospital_name,
        hospital_phone=req.hospital_phone,
    )
    return {"note": note, "sent_at": _now_iso()}


@app.post("/api/sms")
def api_sms(req: SmsRequest) -> Dict[str, Any]:
    incident = db.get_incident(req.incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="incident not found")

    lat = float(incident["lat"])
    lng = float(incident["lng"])
    severity = str(incident.get("severity") or "UNKNOWN")
    return sms.send_sos_sms(lat=lat, lng=lng, severity=severity, incident_id=req.incident_id, contacts=req.contacts)


@app.post("/api/simulate", response_model=SimulateResponse)
def api_simulate() -> SimulateResponse:
    base_lat = 13.0827
    base_lng = 80.2707
    lat = base_lat + random.uniform(-0.006, 0.006)
    lng = base_lng + random.uniform(-0.006, 0.006)
    incident_id = _incident_id()
    db.insert_incident(incident_id, lat, lng, victim_count=1, status="active")
    return SimulateResponse(
        incident_id=incident_id,
        lat=lat,
        lng=lng,
        message="Simulated incident created near Chennai.",
    )

