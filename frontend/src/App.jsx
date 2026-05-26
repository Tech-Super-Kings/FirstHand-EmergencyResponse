import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

import DemoButton from "./components/DemoButton.jsx";
import LegalShield from "./screens/LegalShield.jsx";
import BystanderMesh from "./screens/BystanderMesh.jsx";
import TriageFlow from "./screens/TriageFlow.jsx";
import HospitalFinder from "./screens/HospitalFinder.jsx";
import HandoffNote from "./screens/HandoffNote.jsx";

const CHENNAI = { lat: 13.0827, lng: 80.2707 };

const STEP_LABELS = ["Legal Shield", "Bystander Mesh", "Triage Flow", "Hospital Finder", "Handoff Note"];

export default function App() {
  const [incidentId, setIncidentId] = useState("");
  const [currentScreen, setCurrentScreen] = useState(0);
  const [lat, setLat] = useState(CHENNAI.lat);
  const [lng, setLng] = useState(CHENNAI.lng);
  const [severity, setSeverity] = useState("UNKNOWN");
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [gpsSource, setGpsSource] = useState("fallback");
  const [toastMessage, setToastMessage] = useState("");
  const toastTimer = useRef(null);

  function toast(msg) {
    setToastMessage(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(""), 3000);
  }

  useEffect(() => {
    const onOn = () => setIsOffline(false);
    const onOff = () => setIsOffline(true);
    window.addEventListener("online", onOn);
    window.addEventListener("offline", onOff);
    return () => {
      window.removeEventListener("online", onOn);
      window.removeEventListener("offline", onOff);
    };
  }, []);

  useEffect(() => {
    let done = false;
    const options = { enableHighAccuracy: true, timeout: 5000, maximumAge: 15000 };
    if (!navigator.geolocation) {
      setGpsSource("fallback");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (done) return;
        done = true;
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setGpsSource("device");
      },
      () => {
        if (done) return;
        done = true;
        setLat(CHENNAI.lat);
        setLng(CHENNAI.lng);
        setGpsSource("fallback");
      },
      options
    );
    return () => {
      done = true;
    };
  }, []);

  const progressPct = useMemo(() => {
    return Math.max(0, Math.min(100, (currentScreen / 4) * 100));
  }, [currentScreen]);

  const header = useMemo(() => {
    const active = !!incidentId;
    return (
      <header className="fh-header">
        <div className="fh-brand">
          <div>
            <div className="fh-logo">FirstHand</div>
            {currentScreen > 0 ? (
              <div className="fh-step-label">
                Step {currentScreen + 1} of 5 · {STEP_LABELS[currentScreen]}
              </div>
            ) : null}
          </div>
          {active ? <div className="fh-incident-dot" title="Incident Active" /> : null}
        </div>
        <div className="fh-gps-badge">
          {gpsSource === "device" ? "📍 GPS Active" : "📍 Chennai (Demo Mode)"}
        </div>
      </header>
    );
  }, [incidentId, gpsSource, currentScreen]);

  const progress = useMemo(() => {
    return (
      <div className="fh-progress-track" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
        <div className="fh-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
    );
  }, [progressPct]);

  async function ensureIncident() {
    if (incidentId) return incidentId;
    const res = await axios.post("/api/trigger", { lat, lng, victim_count: 1 });
    setIncidentId(res.data.incident_id);
    return res.data.incident_id;
  }

  const goAfterLegalShield = useCallback(async () => {
    try {
      await ensureIncident();
      setCurrentScreen(1);
    } catch {
      toast("Failed to create incident. Is the backend running?");
    }
  }, [lat, lng, incidentId]);

  function resetAll(nextIncident) {
    setSeverity("UNKNOWN");
    setSelectedHospital(null);
    if (nextIncident) {
      setIncidentId(nextIncident.incident_id);
      setLat(nextIncident.lat);
      setLng(nextIncident.lng);
    } else {
      setIncidentId("");
    }
    setCurrentScreen(0);
  }

  let screen = null;
  if (currentScreen === 0) {
    screen = <LegalShield onComplete={goAfterLegalShield} />;
  } else if (currentScreen === 1) {
    screen = <BystanderMesh incidentId={incidentId} lat={lat} lng={lng} onTriage={() => setCurrentScreen(2)} />;
  } else if (currentScreen === 2) {
    screen = (
      <TriageFlow
        incidentId={incidentId}
        onComplete={(sev) => {
          setSeverity(sev);
          setCurrentScreen(3);
        }}
      />
    );
  } else if (currentScreen === 3) {
    screen = (
      <HospitalFinder
        lat={lat}
        lng={lng}
        severity={severity}
        incidentId={incidentId}
        onSelect={(h) => {
          setSelectedHospital(h);
          setCurrentScreen(4);
        }}
      />
    );
  } else {
    screen = <HandoffNote incidentId={incidentId} hospital={selectedHospital} />;
  }

  return (
    <div className="fh-app">
      {isOffline ? <div className="fh-offline-banner">Offline mode — using cached data if available</div> : null}
      {currentScreen > 0 ? (
        <>
          {header}
          {progress}
        </>
      ) : null}
      {toastMessage ? <div className="fh-toast">{toastMessage}</div> : null}

      <div className="fh-screen-wrap" key={currentScreen}>
        {screen}
      </div>

      <DemoButton
        onSimulate={(data) => {
          resetAll(data);
          if (data) toast("Simulated accident created.");
        }}
      />
    </div>
  );
}
