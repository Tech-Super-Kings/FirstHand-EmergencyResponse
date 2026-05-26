
# FirstHand – AI-Assisted Emergency Response Platform

FirstHand is an AI-powered emergency response coordination platform built for rapid accident response, triage, hospital routing, and emergency handoff in real time.



## 🚑 Problem Statement

In critical emergencies, delays in:
- bystander coordination
- triage assessment
- hospital discovery
- emergency communication

can cost lives.

FirstHand helps coordinate emergency response instantly using real-time workflows and AI-assisted decision support.



## ✨ Features

- Real-time Bystander Coordination
- AI-Assisted Triage Flow
- Nearby Hospital Discovery
- Emergency Severity Routing
- Hospital Capability Matching
- Emergency Handoff Workflow
- Live Incident Simulation
- Responsive Modern UI/UX
- FastAPI + React Architecture
- WebSocket-based Live Updates



## 🧠 Tech Stack

### Frontend
- React
- Vite
- CSS3
- Leaflet Maps

### Backend
- FastAPI
- Python
- SQLite
- WebSockets


## 🏥 Hospital Routing

The platform dynamically routes incidents to nearby hospitals based on:
- distance
- severity
- trauma capability
- ICU availability
- surgery support

Includes IITM Institute Hospital integration for Chennai-based routing simulation.



## ⚡ Local Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
py -3 -m uvicorn main:app --reload --port 8000
````

### Frontend

```bash
cd frontend
npm install
npm run dev
```


## 🌐 Local URLs

| Service      | URL                                                      |
| ------------ | -------------------------------------------------------- |
| Frontend     | [http://127.0.0.1:5173](http://127.0.0.1:5173)           |
| Backend API  | [http://127.0.0.1:8000](http://127.0.0.1:8000)           |
| Swagger Docs | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) |



## 📂 Project Structure

```txt
FirstHand-EmergencyResponse/
│
├── backend/
│   ├── main.py
│   ├── db.py
│   ├── hospitals.py
│   ├── sms.py
│   ├── triage.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── .gitignore
├── LICENSE
└── README.md
```


## Key Highlights

* Modern dark-themed responsive UI
* Real-time emergency coordination
* Hospital capability filtering
* WebSocket-based live updates
* IIT Madras hospital integration
* Modular FastAPI backend
* Clean React frontend architecture



## Team

**Tech-Super-Kings**
IITM Hackathon 2026



## Status

Hackathon Prototype – Active Development



## 📜 License

MIT License


