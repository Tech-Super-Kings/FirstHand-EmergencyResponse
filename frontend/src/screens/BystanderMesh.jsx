import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Circle, MapContainer, TileLayer } from "react-leaflet";

function skillBadge(skill) {
  const map = {
    medical: { bg: "rgba(59,130,246,0.18)", fg: "#93C5FD", label: "Medical" },
    first_aid: { bg: "rgba(34,197,94,0.18)", fg: "#86EFAC", label: "First Aid" },
    none: { bg: "rgba(148,163,184,0.12)", fg: "#E2E8F0", label: "No Training" }
  };
  return map[skill] || map.none;
}

function wsLabel(state) {
  if (state === "open") return "Live";
  if (state === "connecting") return "Connecting…";
  if (state === "error") return "Error";
  return "Reconnecting…";
}

export default function BystanderMesh({ incidentId, lat, lng, onTriage }) {
  const [name, setName] = useState("");
  const [assignedRole, setAssignedRole] = useState(null);
  const [bystanders, setBystanders] = useState([]);
  const [wsState, setWsState] = useState("connecting");
  const wsRef = useRef(null);

  const wsUrl = useMemo(() => {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.host}/ws/bystanders/${incidentId}`;
  }, [incidentId]);

  useEffect(() => {
    if (!incidentId) return;
    let cancelled = false;
    let retryTimer = null;
    let ws = null;

    function connect() {
      if (cancelled) return;
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setWsState("connecting");

      ws.onopen = () => {
        if (!cancelled) setWsState("open");
      };
      ws.onclose = () => {
        if (cancelled) return;
        setWsState("closed");
        retryTimer = setTimeout(connect, 2500);
      };
      ws.onerror = () => setWsState("error");
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "bystander_joined" && Array.isArray(msg.bystanders)) {
            setBystanders(msg.bystanders);
          }
          if (msg.type === "bystander_committed" && msg.bystander) {
            setBystanders((prev) => {
              const exists = prev.some((b) => b.id === msg.bystander.id);
              return exists ? prev : [...prev, msg.bystander];
            });
          }
        } catch {
          // ignore
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      try {
        ws?.close();
      } catch {
        // ignore
      }
    };
  }, [incidentId, wsUrl]);

  async function commit(skill) {
    const safeName = (name || "").trim() || "Anonymous";
    const res = await axios.post("/api/bystander/commit", { incident_id: incidentId, name: safeName, skill });
    setAssignedRole(res.data.role);

    try {
      wsRef.current?.send(
        JSON.stringify({
          type: "bystander_committed",
          incident_id: incidentId,
          bystander: {
            id: res.data.bystander_id,
            incident_id: incidentId,
            name: safeName,
            skill,
            committed: 1,
            role: res.data.role,
            created_at: new Date().toISOString()
          }
        })
      );
    } catch {
      // ignore
    }
  }

  const liveClass = wsState === "open" ? "fh-live-dot fh-live-dot--open" : "fh-live-dot fh-live-dot--closed";

  return (
    <div className="fh-page">
      <div className="fh-status-row">
        <h1 className="fh-page-title">Bystander Mesh</h1>
        <div className={liveClass}>
          <span />
          {wsLabel(wsState)}
        </div>
      </div>

      <div className="fh-map">
        <MapContainer
          center={[lat, lng]}
          zoom={16}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Circle
            center={[lat, lng]}
            radius={55}
            pathOptions={{ color: "#EF4444", fillColor: "#EF4444", fillOpacity: 0.35 }}
          />
        </MapContainer>
      </div>

      <div className="fh-input-wrap">
        <span className="fh-input-icon" aria-hidden="true">
          👤
        </span>
        <input
          className="fh-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          aria-label="Your name"
        />
      </div>

      <div className="fh-btn-stack">
        <button type="button" onClick={() => commit("first_aid")} className="fh-btn-skill" style={{ background: "rgba(34,197,94,0.14)", color: "#D1FAE5" }}>
          First-aid
          <small>I can do physical first aid tasks.</small>
        </button>
        <button type="button" onClick={() => commit("medical")} className="fh-btn-skill" style={{ background: "rgba(59,130,246,0.14)", color: "#DBEAFE" }}>
          Medical
          <small>I can coordinate and assess ABC.</small>
        </button>
        <button type="button" onClick={() => commit("none")} className="fh-btn-skill" style={{ background: "rgba(148,163,184,0.12)", color: "#E2E8F0" }}>
          No-training
          <small>I can manage crowd, calling, logistics.</small>
        </button>
      </div>

      {assignedRole ? <div className="fh-role-banner">Assigned role: {assignedRole}</div> : null}

      <div className="fh-card">
        <div style={{ fontWeight: 900, marginBottom: 12, fontSize: "0.95rem" }}>Live Bystanders</div>
        {bystanders.length === 0 ? (
          <div className="fh-empty">No one committed yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {bystanders.map((b) => {
              const badge = skillBadge(b.skill);
              return (
                <div key={b.id} className="fh-bystander-item">
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                    <div style={{ fontWeight: 900 }}>{b.name}</div>
                    <div style={{ fontSize: 12, color: "rgba(226,232,240,0.8)", fontWeight: 600, lineHeight: 1.35 }}>{b.role}</div>
                  </div>
                  <div className="fh-badge" style={{ background: badge.bg, color: badge.fg, flexShrink: 0 }}>
                    {badge.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button type="button" onClick={onTriage} className="fh-btn fh-btn-primary" style={{ width: "100%" }}>
        Proceed to Triage →
      </button>
    </div>
  );
}
