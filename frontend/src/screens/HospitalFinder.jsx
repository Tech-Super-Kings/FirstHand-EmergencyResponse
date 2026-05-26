import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

function pill(label, on) {
  return (
    <span className={`fh-pill ${on ? "fh-pill--on" : "fh-pill--off"}`} key={label}>
      {label}
    </span>
  );
}

export default function HospitalFinder({ lat, lng, severity, incidentId, onSelect }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function run() {
      setLoading(true);
      setError("");
      try {
        const res = await axios.get("/api/hospitals", { params: { lat, lng, severity } });
        if (!alive) return;
        setItems(Array.isArray(res.data) ? res.data : []);
        try {
          localStorage.setItem("fh_hospitals_cache", JSON.stringify(res.data));
        } catch {
          // ignore
        }
      } catch (e) {
        if (!alive) return;
        setError("Unable to fetch hospitals (offline?).");
        try {
          const cached = JSON.parse(localStorage.getItem("fh_hospitals_cache") || "[]");
          setItems(Array.isArray(cached) ? cached.slice(0, 5) : []);
        } catch {
          setItems([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [lat, lng, severity, incidentId]);

  const header = useMemo(() => {
    return (
      <div className="fh-status-row">
        <h1 className="fh-page-title">Hospital Finder</h1>
        <div
          className="fh-gps-badge"
          style={{ color: severity === "CRITICAL" ? "#FCA5A5" : undefined, borderColor: severity === "CRITICAL" ? "rgba(239,68,68,0.4)" : undefined }}
        >
          Severity: {severity}
        </div>
      </div>
    );
  }, [severity]);

  return (
    <div className="fh-page">
      {header}
      {loading ? (
        <div className="fh-loading">
          <span className="fh-spinner" />
          Loading hospitals…
        </div>
      ) : null}
      {error ? <div className="fh-error">{error}</div> : null}

      {items.map((h, idx) => {
        const criticalFirst = severity === "CRITICAL" && idx === 0;
        const pills = [
          pill("ICU", !!h.has_icu),
          pill("Surgery", !!h.has_surgery),
          pill("Blood", !!h.has_blood_bank),
          pill("Trauma", !!h.is_trauma_centre)
        ];

        return (
          <div
            key={h.id || idx}
            className={`fh-hospital-card${criticalFirst ? " fh-hospital-card--critical" : ""}`}
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div style={{ fontWeight: 900, fontSize: "1.05rem", lineHeight: 1.3, letterSpacing: "-0.02em" }}>{h.name}</div>
              <div className="fh-distance-chip">{h.distance_km} km</div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ color: "rgba(226,232,240,0.85)", fontWeight: 700, fontSize: "0.85rem" }}>
                Drive time: {h.drive_time_min} min
              </div>
              <div style={{ color: "rgba(226,232,240,0.65)", fontWeight: 700, fontSize: "0.8rem" }}>
                Level: {h.level || "—"}
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{pills}</div>

            <div className="fh-grid-2">
              <a href={`tel:${h.phone}`} className="fh-link-btn fh-btn-ghost" style={{ color: "#fff" }}>
                Call
              </a>
              <button type="button" onClick={() => onSelect(h)} className="fh-btn fh-btn-primary">
                Select &amp; Brief
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
