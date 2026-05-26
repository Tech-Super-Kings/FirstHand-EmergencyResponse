import React, { useMemo, useState } from "react";
import axios from "axios";

const QUESTIONS = [
  { key: "conscious", title: "Is the victim conscious?" },
  { key: "breathing", title: "Is the victim breathing normally?" },
  { key: "bleeding", title: "Is there severe bleeding?" },
  { key: "moving", title: "Can the victim move normally?" }
];

export default function TriageFlow({ incidentId, onComplete }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const dots = useMemo(() => {
    return (
      <div className="fh-dots" aria-label={`Question ${step + 1} of ${QUESTIONS.length}`}>
        {QUESTIONS.map((q, i) => (
          <div
            key={q.key}
            className={`fh-dot${i === step ? " fh-dot--active" : ""}${answers[q.key] && i !== step ? " fh-dot--done" : ""}`}
          />
        ))}
      </div>
    );
  }, [step, answers]);

  async function answer(val) {
    const q = QUESTIONS[step];
    const nextAnswers = { ...answers, [q.key]: val };
    setAnswers(nextAnswers);

    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await axios.post("/api/triage", { incident_id: incidentId, answers: nextAnswers });
      setResult(res.data);
    } catch {
      setError("Triage failed. Check that the backend is running and try again.");
      setStep(QUESTIONS.length - 1);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="fh-page">
        <h1 className="fh-page-title">Triage Result</h1>
        <div className="fh-severity-card fh-card-glow" style={{ border: `1px solid ${result.color}` }}>
          <div className="fh-severity-label">Severity</div>
          <div className="fh-severity-value" style={{ color: result.color }}>
            {result.severity}
          </div>
          <div style={{ marginTop: 12, color: "rgba(226,232,240,0.92)", fontWeight: 700, lineHeight: 1.5, fontSize: "0.95rem" }}>
            {result.action}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: "rgba(226,232,240,0.65)", fontWeight: 700 }}>
            Confidence: {result.confidence} · Recommended hospital: {result.recommended_hospital_level}
          </div>
        </div>
        <button type="button" onClick={() => onComplete(result.severity)} className="fh-btn fh-btn-primary" style={{ width: "100%" }}>
          Find Hospital →
        </button>
      </div>
    );
  }

  const q = QUESTIONS[step];
  return (
    <div className="fh-page">
      <div>
        <h1 className="fh-page-title">Triage Flow</h1>
        <p className="fh-page-subtitle">
          Question {step + 1} of {QUESTIONS.length}
        </p>
      </div>
      {dots}
      <div className="fh-card fh-card-glow">
        <div style={{ fontSize: "1.2rem", fontWeight: 800, marginBottom: 16, lineHeight: 1.35, letterSpacing: "-0.02em" }}>
          {q.title}
        </div>
        <div className="fh-btn-stack">
          <button type="button" onClick={() => answer("yes")} disabled={loading} className="fh-btn-choice fh-btn-choice--yes">
            Yes
          </button>
          <button type="button" onClick={() => answer("unsure")} disabled={loading} className="fh-btn-choice fh-btn-choice--unsure">
            Unsure
          </button>
          <button type="button" onClick={() => answer("no")} disabled={loading} className="fh-btn-choice fh-btn-choice--no">
            No
          </button>
        </div>
        {loading ? (
          <div className="fh-loading" style={{ marginTop: 16 }}>
            <span className="fh-spinner" />
            Analyzing…
          </div>
        ) : null}
        {error ? <div className="fh-error" style={{ marginTop: 12 }}>{error}</div> : null}
      </div>
    </div>
  );
}
