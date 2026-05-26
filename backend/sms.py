import os
from datetime import datetime, timezone
from typing import Any, Dict, List


def send_sos_sms(lat: float, lng: float, severity: str, incident_id: str, contacts: List[str]) -> Dict[str, Any]:
    try:
        account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
        auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
        from_number = os.environ.get("TWILIO_FROM")
        if not account_sid or not auth_token or not from_number:
            return {"sent": False, "error": "not configured", "recipients": [], "failed": contacts}

        from twilio.rest import Client  # type: ignore

        client = Client(account_sid, auth_token)
        ts = datetime.now(timezone.utc).isoformat()
        link = f"https://maps.google.com/?q={lat},{lng}"
        body = f"[FirstHand SOS] Severity: {severity} | Incident: {incident_id} | Location: {link} | Time: {ts}"

        recipients: List[str] = []
        failed: List[str] = []
        for to in contacts:
            try:
                client.messages.create(from_=from_number, to=to, body=body)
                recipients.append(to)
            except Exception:
                failed.append(to)

        return {"sent": len(recipients) > 0, "recipients": recipients, "failed": failed}
    except Exception:
        return {"sent": False, "error": "not configured", "recipients": [], "failed": contacts}

