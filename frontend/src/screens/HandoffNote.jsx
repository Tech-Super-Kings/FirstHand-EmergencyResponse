import React, { useEffect, useState } from "react";
import axios from "axios";

export default function HandoffNote({ incidentId, hospital }) {
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function run() {
      setLoading(true);
      try {
        const res = await axios.post("/api/handoff", {
          incident_id: incidentId,
          hospital_name: hospital?.name || "",
          hospital_phone: hospital?.phone || ""
        });
        if (!alive) return;
        setNote(res.data.note || "");
      } catch {
        if (!alive) return;
        setNote("Unable to generate handoff note. Is the backend running?");
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [incidentId, hospital]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(note);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="fh-page">
      <h1 className="fh-page-title">Handoff Note</h1>
      <div className="fh-card fh-card-glow">
        {loading ? (
          <div className="fh-loading" style={{ marginBottom: 12 }}>
            <span className="fh-spinner" />
            Generating…
          </div>
        ) : null}
        <div className="fh-note-box">{note || "—"}</div>
      </div>

      <div className="fh-grid-2">
        <button type="button" onClick={copy} className="fh-btn fh-btn-ghost">
          {copied ? "Copied ✓" : "Copy Note"}
        </button>
        <a href={`tel:${hospital?.phone || ""}`} className="fh-link-btn fh-btn-primary">
          Call Hospital
        </a>
      </div>

      <p className="fh-footer-hint">Analysis based on rule-based anomaly detection · real-time data</p>
    </div>
  );
}
