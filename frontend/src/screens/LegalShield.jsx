import React, { useEffect } from "react";

export default function LegalShield({ onComplete }) {
  useEffect(() => {
    const t = setTimeout(() => onComplete(), 3000);
    return () => clearTimeout(t);
  }, [onComplete]);

  const shield = (
    <svg width="72" height="84" viewBox="0 0 60 70" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M30 2C40 8 50 10 56 12V34C56 51 45 63 30 68C15 63 4 51 4 34V12C10 10 20 8 30 2Z"
        fill="#22C55E"
        opacity="0.95"
      />
      <path
        d="M18 34L26 42L44 24"
        stroke="#052E16"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div className="fh-legal">
      <div className="fh-legal-card">
        {shield}
        <h1 className="fh-legal-title">You are protected.</h1>
        <p className="fh-legal-sub1">India&apos;s Good Samaritan Law 2015</p>
        <p className="fh-legal-sub2">SC Writ Petition (C) 235/2012</p>
        <div className="fh-legal-body">
          You cannot be questioned or detained for helping. There is no civil/criminal liability for good-faith
          assistance. Your identity can remain confidential if you choose.
        </div>
        <div className="fh-legal-bar">
          <div className="fh-legal-bar-fill" />
        </div>
      </div>
      <button type="button" onClick={onComplete} className="fh-skip">
        Skip →
      </button>
    </div>
  );
}
