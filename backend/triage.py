from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List


def classify_severity(answers: Dict[str, str]) -> Dict[str, Any]:
    conscious = answers.get("conscious", "unsure")
    breathing = answers.get("breathing", "unsure")
    bleeding = answers.get("bleeding", "unsure")
    moving = answers.get("moving", "unsure")

    severity = "MINOR"
    if conscious == "no" or breathing == "no" or bleeding == "yes":
        severity = "CRITICAL"
    elif (
        conscious == "unsure"
        or breathing == "unsure"
        or bleeding == "unsure"
        or moving == "unsure"
        or (moving == "no" and conscious == "yes")
    ):
        severity = "SERIOUS"

    if severity == "CRITICAL":
        action = "Call 108/112 now. Open airway, support breathing, control bleeding. Prepare rapid transport."
        color = "#EF4444"
        recommended = "L1"
        confidence = 0.92 if "unsure" not in (conscious, breathing, bleeding, moving) else 0.84
    elif severity == "SERIOUS":
        action = "Keep victim still and warm. Monitor breathing and bleeding. Arrange transport to a capable centre."
        color = "#F59E0B"
        recommended = "L2"
        confidence = 0.78 if "unsure" in (conscious, breathing, bleeding, moving) else 0.82
    else:
        action = "Provide basic first aid. Reassure the victim and monitor for changes while help arrives."
        color = "#22C55E"
        recommended = "L3"
        confidence = 0.70

    return {
        "severity": severity,
        "action": action,
        "confidence": round(float(confidence), 2),
        "color": color,
        "recommended_hospital_level": recommended,
    }


def assign_bystander_roles(bystanders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    roles: Dict[str, str] = {}

    medical_leads = [b for b in bystanders if b.get("skill") == "medical"]
    if medical_leads:
        lead = medical_leads[0]
        roles[lead["id"]] = "Medical Lead: take charge, assess ABC, delegate tasks, keep updates flowing."

    first_aid_tasks = [
        "First Aid: check airway and breathing; keep head aligned; do not move unless unsafe.",
        "First Aid: apply firm pressure to bleeding; elevate limb if safe; keep dressing in place.",
        "First Aid: keep victim warm and calm; watch for shock; note any worsening.",
    ]
    crowd_tasks = [
        "Crowd Control: keep crowd 10m back; create a clear lane for ambulance access.",
        "Logistics: flag ambulance/police; guide them to the exact spot; share GPS pin.",
        "Comms: call emergency number; relay victim count, severity, and changes clearly.",
    ]

    first_aid_people = [b for b in bystanders if b.get("skill") == "first_aid"]
    none_people = [b for b in bystanders if b.get("skill") == "none"]
    other_medical = [b for b in bystanders if b.get("skill") == "medical" and b["id"] not in roles]

    ordered = other_medical + first_aid_people + none_people
    fa_i = 0
    cr_i = 0
    for b in ordered:
        bid = b["id"]
        if bid in roles:
            continue
        if b.get("skill") == "medical":
            roles[bid] = "Medical Support: assist lead; re-check ABC; watch breathing and bleeding."
        elif b.get("skill") == "first_aid":
            roles[bid] = first_aid_tasks[min(fa_i, len(first_aid_tasks) - 1)]
            fa_i += 1
        else:
            roles[bid] = crowd_tasks[min(cr_i, len(crowd_tasks) - 1)]
            cr_i += 1

    out: List[Dict[str, Any]] = []
    for b in bystanders:
        out.append({**b, "role": roles.get(b["id"], b.get("role", ""))})
    return out


def generate_handoff_note(
    incident: Dict[str, Any],
    triage_row: Dict[str, Any] | None,
    bystanders: List[Dict[str, Any]],
    hospital_name: str = "",
    hospital_phone: str = "",
) -> str:
    created_at = incident.get("created_at") or datetime.now(timezone.utc).isoformat()
    lat = incident.get("lat")
    lng = incident.get("lng")
    maps_link = f"https://maps.google.com/?q={lat},{lng}"
    victim_count = incident.get("victim_count", 1)
    severity = (triage_row or {}).get("severity") or incident.get("severity", "UNKNOWN")

    conscious = (triage_row or {}).get("conscious", "unsure")
    breathing = (triage_row or {}).get("breathing", "unsure")
    bleeding = (triage_row or {}).get("bleeding", "unsure")
    moving = (triage_row or {}).get("moving", "unsure")

    assigned = assign_bystander_roles(bystanders)

    lines: List[str] = []
    lines.append(f"FIRSTHAND HANDOFF  |  ID: {incident.get('id')}  |  TIME: {created_at}")
    lines.append(f"GPS: {maps_link}")
    lines.append(f"VICTIMS: {victim_count}  |  SEVERITY: {severity}")
    if hospital_name:
        phone = f" ({hospital_phone})" if hospital_phone else ""
        lines.append(f"DESTINATION: {hospital_name}{phone}")
    lines.append("TRIAGE (bystander-reported):")
    lines.append(f"- Conscious: {conscious} | Breathing: {breathing} | Bleeding: {bleeding} | Moving: {moving}")
    lines.append("BYSTANDERS / ROLES:")
    if assigned:
        for b in assigned:
            name = b.get("name", "Unknown")
            skill = b.get("skill", "none")
            role = b.get("role", "")
            lines.append(f"- {name} ({skill}): {role}")
    else:
        lines.append("- None committed yet.")
    lines.append("IMMEDIATE ACTIONS:")
    if severity == "CRITICAL":
        lines.append("- Airway open, support breathing, control bleeding; rapid transfer to ICU/blood-capable centre.")
    elif severity == "SERIOUS":
        lines.append("- Keep still, keep warm, monitor breathing/bleeding; transfer to trauma-capable centre.")
    else:
        lines.append("- Basic first aid; monitor; escalate if breathing/bleeding/consciousness worsens.")
    return "\n".join(lines)

