import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

export default function DemoButton({ onSimulate }) {
  const [active, setActive] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!active) return;
    if (countdown <= 0) {
      setActive(false);
      setCountdown(60);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [active, countdown]);

  const label = useMemo(() => {
    if (busy) return "Simulating…";
    if (active) return `Active — ${countdown}s`;
    return "Simulate Accident ⚡";
  }, [busy, active, countdown]);

  async function handleClick() {
    if (busy) return;
    if (active) return;
    setBusy(true);
    try {
      const res = await axios.post("/api/simulate");
      onSimulate(res.data);
      setActive(true);
      setCountdown(60);
    } finally {
      setBusy(false);
    }
  }

  function handleReset() {
    setActive(false);
    setCountdown(60);
    onSimulate(null);
  }

  return (
    <>
      {active ? (
        <button type="button" onClick={handleReset} className="fh-demo-reset">
          Reset Demo
        </button>
      ) : null}
      <button type="button" onClick={handleClick} disabled={busy} className="fh-demo-btn">
        {label}
      </button>
    </>
  );
}
