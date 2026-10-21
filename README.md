# EV Powertrain Intelligence Platform ⚡🏎️

A production-grade, full-stack engineering application that combines **physics-based battery pack optimization** with **gradient-boosted machine learning (XGBoost)** to design, evaluate, and predict electric vehicle powertrain efficiency and battery pack performance.

Engineered with a focus on Formula Student (FSAE), Formula E, and high-performance motorsport telemetry standards.

---

## 📋 Table of Contents

- [System Architecture](#system-architecture)
- [Key Features](#key-features)
- [Model Artifacts & Inventory](#model-artifacts--inventory)
- [Expected Features (24 Input Dimensions)](#expected-features-24-input-dimensions)
- [Installation & Environment Setup](#installation--environment-setup)
- [Quick Start Guide](#quick-start-guide)
  - [1. Running the FastAPI Backend](#1-running-the-fastapi-backend)
  - [2. Running the Modern Frontend](#2-running-the-modern-frontend)
  - [3. Running the Legacy Interactive CLI](#3-running-the-legacy-interactive-cli)
- [API Reference](#api-reference)
- [Verification & Automated Test Suite](#verification--automated-test-suite)
- [Engineering Provenance & Limitations](#engineering-provenance--limitations)
- [Troubleshooting](#troubleshooting)
- [Author & License](#author--license)

---

## 🏗️ System Architecture

```text
XG_BoostPrediction/
├── backend/
│   ├── __init__.py
│   ├── physics_engine.py          # Pure physics module: vehicle dynamics, pack design & feature builder
│   └── server.py                  # FastAPI REST API with CORS, Pydantic v2 schemas & endpoints
├── frontend/
│   ├── src/
│   │   ├── components/            # Motorsport telemetry UI (Dashboard, Studio, Analytics, Insights, Explorer)
│   │   ├── services/api.js        # Client-side API integration
│   │   ├── App.jsx & main.jsx     # Main React application
│   │   └── index.css              # Dark graphite & neon motorsport theme
│   ├── package.json
│   └── vite.config.js             # Vite development server with API proxy (/api -> :8000)
├── models/
│   ├── powertrain_physics_model.joblib  # Primary XGBoost model (300 estimators, depth 6)
│   └── battery_pack_model.joblib        # Battery pack surrogate model dictionary (7 XGBRegressors)
├── powertrain_physics_model.joblib      # Deep XGBoost model (600 estimators, depth 7)
├── predict.py                     # Non-interactive CLI script utilizing backend.physics_engine
├── requirements.txt               # Pinned Python backend dependencies
├── tests.py                       # 39 comprehensive unit, validation, API, and regression tests
└── README.md                      # Complete system documentation
```

---

## ⚡ Key Features

1. **Constrained Battery Pack Optimization:**
   - Searches series/parallel module topologies ($S \times P$) satisfying module voltage ($\le 60\text{ V}$ safety limit), module mass ($\le 12\text{ kg}$ rule compliance), and pack mass ($\le 60\text{ kg}$) constraints.
   - Evaluates internal resistance, voltage sag under peak discharge current ($I_{\text{pack}} = P_{\text{peak}} / V_{\text{pack}}$), and true battery efficiency ($\eta_{\text{batt}} = V_{\text{load}} / V_{\text{pack}}$).

2. **24-Feature XGBoost Inference Pipeline:**
   - Computes vehicle resistive forces ($F_{\text{roll}}$, $F_{\text{aero}}$, $F_{\text{accel}}$), wheel torques, motor RPMs, and mechanical power requirements at key velocity checkpoints ($0\text{ m/s}$, $5\text{ m/s}$, and $20\text{ m/s}$).
   - Predicts overall powertrain efficiency using pre-trained XGBoost regression models without hardcoded or simulated values.

3. **Telemetry & Physics Visualizations:**
   - Vehicle Speed vs. Motor RPM curve.
   - Vehicle Speed vs. Wheel & Motor Torque.
   - Required Mechanical Power vs. Speed.
   - Nominal vs. Loaded Battery Voltage comparison with internal resistance voltage drop.
   - Interactive Module & Cell Topology Layout visualizer ($S \times P$ matrix).

4. **Batch Inference & Telemetry CSV Explorer:**
   - Upload CSV telemetry datasets to execute batch inference across dozens of vehicle and battery configurations simultaneously with validation and CSV export.

5. **Multi-Model Support:**
   - Switch between **Primary Model** (`models/powertrain_physics_model.joblib`, 300 estimators) and **Deep Model** (`powertrain_physics_model.joblib`, 600 estimators) directly from the interface.

---

## 🧠 Model Artifacts & Inventory

| Artifact Path | Artifact Type | Dimensions | Hyperparameters / Details |
|---|---|---|---|
| `models/powertrain_physics_model.joblib` | `XGBRegressor` | 24 features | Primary model: `n_estimators=300`, `max_depth=6`, `learning_rate=0.05`, `colsample_bytree=0.8` |
| `powertrain_physics_model.joblib` | `XGBRegressor` | 24 features | Deep model: `n_estimators=600`, `max_depth=7`, `learning_rate=0.03`, `colsample_bytree=0.7` |
| `models/battery_pack_model.joblib` | `dict` of 7 `XGBRegressor` | 7 inputs | Multi-target battery pack surrogate: `S_mod`, `P_mod`, `Ns_modules`, `Np`, `V_pack`, `V_load`, `Battery_eff` |

> [!NOTE]
> All model paths are resolved relative to the file location in Python (`Path(__file__).resolve()`), so scripts and servers run reliably from any current working directory.

---

## 📊 Expected Features (24 Input Dimensions)

The trained powertrain model strictly expects the following 24 feature columns:

1. `motor_peak` — Motor peak torque (Nm)
2. `motor_cont` — Motor continuous torque (Nm)
3. `gear_ratio` — Single-speed reduction transmission ratio
4. `battery_deg` — Battery degradation / loss factor ($1 - \eta_{\text{batt}}$)
5. `tire_radius` — Outer tire radius (meters)
6. `vehicle_mass` — Total vehicle curb weight including driver (kg)
7. `Cd` — Aerodynamic drag coefficient
8. `A` — Frontal cross-sectional area ($\text{m}^2$)
9. `Cr` — Tire rolling resistance coefficient
10. `rho` — Air density ($1.225\text{ kg/m}^3$)
11. `cont_ratio` — Thermal derating ratio ($\text{motor\_cont} / \text{motor\_peak}$)
12. `battery_multiplier` — Battery electrical efficiency ($\eta_{\text{batt}}$)
13. `T_wheel_0ms` — Required wheel torque at standstill launch ($v = 0\text{ m/s}$)
14. `T_motor_0ms` — Required motor torque at launch ($v = 0\text{ m/s}$)
15. `rpm_0ms` — Motor rotational speed at standstill ($0\text{ RPM}$)
16. `Preq_0ms` — Mechanical power required at standstill ($0\text{ W}$)
17. `T_wheel_5ms` — Required wheel torque at low-speed corner exit ($v = 5\text{ m/s}$)
18. `T_motor_5ms` — Required motor torque at corner exit ($v = 5\text{ m/s}$)
19. `rpm_5ms` — Motor rotational speed at $5\text{ m/s}$
20. `Preq_5ms` — Mechanical power required at $5\text{ m/s}$
21. `T_wheel_20ms` — Required wheel torque at high-speed straight ($v = 20\text{ m/s}$)
22. `T_motor_20ms` — Required motor torque at high-speed straight ($v = 20\text{ m/s}$)
23. `rpm_20ms` — Motor rotational speed at $20\text{ m/s}$
24. `Preq_20ms` — Mechanical power required at $20\text{ m/s}$

---

## ⚙️ Installation & Environment Setup

### 1. Prerequisites
- **Python**: Version 3.10+ (tested on Python 3.10 and 3.11)
- **Node.js**: Version 18+ and npm

### 2. Backend Setup
From the repository root:

```bash
# Create and activate virtual environment (optional but recommended)
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

# Install required Python packages
pip install -r requirements.txt
```

### 3. Frontend Setup
From the `frontend/` directory:

```bash
cd frontend
npm install
cd ..
```

---

## 🚀 Quick Start Guide

### 1. Running the FastAPI Backend
Start the backend server on port 8000:

```bash
uvicorn backend.server:app --reload --host 127.0.0.1 --port 8000
```

- Health Status: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)
- Interactive OpenAPI Docs: [http://127.0.0.1:8000/api/docs](http://127.0.0.1:8000/api/docs)

### 2. Running the Modern Frontend
In a separate terminal, launch the Vite dev server:

```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. The Vite development proxy automatically forwards `/api` calls to `http://127.0.0.1:8000`.

### 3. Running the Legacy Interactive CLI
The interactive command-line interface is fully preserved and refactored to use the modular physics engine:

```bash
python predict.py
```

---

## 📡 API Reference

### Health & Metadata
- **`GET /api/health`** — Reports backend operational status (`ONLINE`, `DEGRADED`, or `OFFLINE`), artifact loading health, and expected feature counts.
- **`GET /api/status`** — Frontend compatibility alias for `/api/health`.
- **`GET /api/model-info`** (or `/api/model/insights`) — Returns model hyperparameters, tree counts, and calculated feature importances with physics explanations.
- **`GET /api/presets`** — Returns standard engineering presets (FSAE Baseline, High-Energy 21700, Lightweight Sprint, Aero Package).
- **`GET /api/benchmark/dataset`** — Returns verified physics parameter sweeps across battery chemistries (18650 NCA, 21700 NMC, 26650 LFP, Pouch).

### Prediction Endpoints
- **`POST /api/predict`** — Accepts vehicle, motor, cell, and design inputs; optimizes pack topology and runs XGBoost inference.
  
  *Sample Request:*
  ```json
  {
    "motor_peak": 230.0,
    "motor_cont": 120.0,
    "motor_max_rpm": 6000.0,
    "gear_ratio": 4.5,
    "tire_r_in": 9.5,
    "vehicle_mass": 240.0,
    "Cd": 0.85,
    "A": 1.15,
    "Cr": 0.015,
    "V_cell": 3.6,
    "Ah_cell": 3.0,
    "m_cell": 0.048,
    "R_cell": 0.020,
    "I_cell_max": 25.0,
    "V_pack_target": 400.0,
    "P_peak_required": 75000.0,
    "model_choice": "primary"
  }
  ```

- **`POST /api/predict/batch`** — Executes batch predictions on a list of input configurations.
- **`POST /api/upload/csv`** — Accepts a multipart CSV upload containing multiple vehicle rows and returns batch predictions with feasibility diagnostics.

---

## 🧪 Verification & Automated Test Suite

The test suite covers:
1. **Physics Engine Calculations:** Launch acceleration, torque floor, RPM mapping, mechanical power, and aerodynamic resistance.
2. **Battery Pack Optimizer:** Module voltage constraints ($\le 60\text{ V}$), pack mass limits, voltage sag, and efficiency monotonicity.
3. **Pydantic Validation:** Bounds checking, negative values, and ensuring continuous torque $\le$ peak torque.
4. **Model Compatibility:** Exact 24-feature ordering and deterministic model inference.
5. **API Endpoints:** Health, prediction, batch prediction, CSV uploads, and benchmark datasets.
6. **Regression Testing:** Verifying refactored calculations match the original script identically.

To run the complete test suite:

```bash
pytest tests.py -v
```

Output:
```text
============================= 39 passed in 2.86s =============================
```

---

## ⚠️ Engineering Provenance & Limitations

- **Simulated vs. Measured:** Powertrain predictions are generated by an XGBoost model trained on physical vehicle simulation profiles. They provide preliminary optimization guidance and are not a substitute for dynamometer testing or cell cycler measurements.
- **Operating Points:** The 24-feature vector evaluates steady-state operating points at $0$, $5$, and $20\text{ m/s}$. These discrete evaluations provide an efficiency proxy but do not represent a continuous 3D motor-inverter efficiency map.
- **Thermal Behavior:** The battery optimizer models instantaneous internal resistance ($I^2R$) voltage drop and nominal efficiency; continuous thermal runaway, cooling jacket pressure drops, and thermal degradation require CFD and transient thermal modeling.

---

## 🛠️ Troubleshooting

1. **`ModuleNotFoundError: No module named 'fastapi'` (or similar):**
   Ensure dependencies are installed: `pip install -r requirements.txt`.
2. **CORS or Network Connection Error in Frontend:**
   Ensure the backend is running at `http://127.0.0.1:8000`. The frontend proxy is configured in `frontend/vite.config.js`.
3. **Model Failed to Load (`DEGRADED` status):**
   Verify that `models/powertrain_physics_model.joblib` exists. The backend resolves paths relative to `backend/server.py`.
4. **Frontend Build Warning:**
   Running `npm run build` inside `frontend/` builds production client bundles into `frontend/dist/`.

---

## 👨‍💻 Author & Acknowledgements

- **Author:** Varad Athalye ([@VaradAAthalye](https://github.com/VaradAAthalye))
- **Domain:** Formula Student EV Powertrain Architecture & Telemetry Intelligence
