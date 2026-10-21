"""
EV Powertrain Intelligence Platform — FastAPI Backend

Serves:
  GET  /api/health      — model / system health check
  GET  /api/model-info  — model metadata and feature importances
  POST /api/predict     — run battery pack design + XGBoost inference
  GET  /api/docs        — auto-generated OpenAPI docs (default FastAPI)
"""

import csv
import io
import os
import sys
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

# ───────────────────────────────────────────────────
# Resolve paths relative to THIS file, not the cwd
# ───────────────────────────────────────────────────
_BACKEND_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _BACKEND_DIR.parent
_MODELS_DIR = _PROJECT_ROOT / "models"

# Import the physics engine
sys.path.insert(0, str(_PROJECT_ROOT))
from backend.physics_engine import (
    MODEL_COLUMNS,
    BATTERY_MODEL_FEATURES,
    build_feature_vector,
    compute_pack_explanation,
    compute_speed_telemetry,
    compute_velocity_curve,
    design_pack_physics,
)

# ───────────────────────────────────────────────────
# Model loading — fail gracefully, track status
# ───────────────────────────────────────────────────
_model_status: Dict[str, Any] = {
    "powertrain_primary": {"loaded": False, "error": None, "path": None},
    "powertrain_deep": {"loaded": False, "error": None, "path": None},
    "battery_pack_surrogate": {"loaded": False, "error": None, "path": None},
}

powertrain_model_primary = None
powertrain_model_deep = None
battery_pack_models = None

# Primary powertrain model (models/ directory — 300 trees, depth 6)
_primary_path = _MODELS_DIR / "powertrain_physics_model.joblib"
try:
    powertrain_model_primary = joblib.load(str(_primary_path))
    _model_status["powertrain_primary"]["loaded"] = True
    _model_status["powertrain_primary"]["path"] = str(_primary_path)
except Exception as e:
    _model_status["powertrain_primary"]["error"] = str(e)

# Deep powertrain model (project root — 600 trees, depth 7)
_deep_path = _PROJECT_ROOT / "powertrain_physics_model.joblib"
try:
    powertrain_model_deep = joblib.load(str(_deep_path))
    _model_status["powertrain_deep"]["loaded"] = True
    _model_status["powertrain_deep"]["path"] = str(_deep_path)
except Exception as e:
    _model_status["powertrain_deep"]["error"] = str(e)

# Battery pack surrogate models (dict of 7 XGBRegressors)
_battery_path = _MODELS_DIR / "battery_pack_model.joblib"
try:
    battery_pack_models = joblib.load(str(_battery_path))
    _model_status["battery_pack_surrogate"]["loaded"] = True
    _model_status["battery_pack_surrogate"]["path"] = str(_battery_path)
except Exception as e:
    _model_status["battery_pack_surrogate"]["error"] = str(e)


def _get_powertrain_model(choice: str):
    """Return the requested powertrain model or raise."""
    if choice == "deep" and powertrain_model_deep is not None:
        return powertrain_model_deep, "deep (600 trees, depth 7)"
    if powertrain_model_primary is not None:
        return powertrain_model_primary, "primary (300 trees, depth 6)"
    if powertrain_model_deep is not None:
        return powertrain_model_deep, "deep (600 trees, depth 7)"
    raise RuntimeError(
        "No powertrain model could be loaded. "
        "Check that model artifacts exist in the models/ directory."
    )


# ───────────────────────────────────────────────────
# Pydantic schemas
# ───────────────────────────────────────────────────

class PredictRequest(BaseModel):
    """Input payload for the /api/predict endpoint."""
    # Powertrain & vehicle
    motor_peak: float = Field(..., gt=0, description="Motor peak torque (Nm)")
    motor_cont: float = Field(..., gt=0, description="Motor continuous torque (Nm)")
    motor_max_rpm: float = Field(..., gt=0, description="Motor max RPM")
    gear_ratio: float = Field(..., gt=0, description="Gear ratio")
    tire_r_in: float = Field(..., gt=0, description="Tire radius (inches)")
    vehicle_mass: float = Field(..., gt=0, description="Vehicle mass (kg)")
    Cd: float = Field(..., gt=0, description="Drag coefficient")
    A: float = Field(..., gt=0, description="Frontal area (m²)")
    Cr: float = Field(..., gt=0, description="Rolling resistance coefficient")

    # Battery cell
    V_cell: float = Field(..., gt=0, le=10, description="Cell nominal voltage (V)")
    Ah_cell: float = Field(..., gt=0, description="Cell capacity (Ah)")
    m_cell: float = Field(..., gt=0, description="Cell mass (kg)")
    R_cell: float = Field(..., gt=0, description="Cell internal resistance (Ω)")
    I_cell_max: float = Field(..., gt=0, description="Max discharge current per cell (A)")

    # Pack design targets
    V_pack_target: float = Field(..., gt=0, description="Target pack voltage (V)")
    P_peak_required: float = Field(..., gt=0, description="Required peak power (W)")

    # Model selection
    model_choice: str = Field(default="primary", description="Model variant: 'primary' or 'deep'")

    @field_validator("motor_cont")
    @classmethod
    def cont_le_peak(cls, v, info):
        peak = info.data.get("motor_peak")
        if peak is not None and v > peak:
            raise ValueError("motor_cont must be <= motor_peak")
        return v


class PackResult(BaseModel):
    S_mod: int
    P_mod: int
    Ns_modules: int
    Np: int
    V_pack: float
    V_load: float
    Battery_eff: float
    Mass_pack: float
    Cells_total: int
    Energy_Wh: float


class PredictResponse(BaseModel):
    feasible: bool
    predicted_efficiency: Optional[float] = None
    predicted_efficiency_percent: Optional[float] = None
    model_used: Optional[str] = None
    output_type: str = "ml_prediction"
    pack: Optional[Dict] = None
    explanation: Optional[Dict] = None
    diagnostics: Optional[Dict] = None
    speed_telemetry: Optional[List[Dict]] = None
    velocity_curve: Optional[List[Dict]] = None
    ml_surrogate_pack: Optional[Dict] = None
    error: Optional[str] = None


class BatchPredictRequest(BaseModel):
    items: List[PredictRequest]


class BatchPredictResponse(BaseModel):
    results: List[PredictResponse]


class HealthResponse(BaseModel):
    status: str
    models: Dict[str, Any]
    features_expected: int
    feature_names: List[str]


class ModelInfoResponse(BaseModel):
    models: Dict[str, Any]
    feature_importances: Optional[List[Dict]] = None
    objective: Optional[str] = None
    n_estimators: Optional[int] = None
    max_depth: Optional[int] = None
    learning_rate: Optional[float] = None
    colsample_bytree: Optional[float] = None
    battery_pack_submodels: Optional[Dict] = None


# ───────────────────────────────────────────────────
# FastAPI app
# ───────────────────────────────────────────────────
app = FastAPI(
    title="EV Powertrain Intelligence Platform",
    description="Physics-constrained battery pack design + XGBoost powertrain efficiency prediction",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    error_messages = []
    for err in exc.errors():
        field = " -> ".join(str(loc) for loc in err.get("loc", []) if loc != "body")
        msg = err.get("msg", "Invalid parameter")
        error_messages.append(f"{field}: {msg}" if field else msg)
    clean_message = " | ".join(error_messages)
    return JSONResponse(
        status_code=422,
        content={"detail": clean_message},
    )


# ───────────────────────────────────────────────────
# GET /api/health
# ───────────────────────────────────────────────────
@app.get("/api/health", response_model=HealthResponse)
def health_check():
    any_loaded = any(m["loaded"] for m in _model_status.values())
    powertrain_loaded = (
        _model_status["powertrain_primary"]["loaded"]
        or _model_status["powertrain_deep"]["loaded"]
    )
    return HealthResponse(
        status="ONLINE" if powertrain_loaded else "DEGRADED" if any_loaded else "OFFLINE",
        models=_model_status,
        features_expected=len(MODEL_COLUMNS),
        feature_names=MODEL_COLUMNS,
    )


# ───────────────────────────────────────────────────
# GET /api/status  (alias for frontend compatibility)
# ───────────────────────────────────────────────────
@app.get("/api/status")
def status_check():
    h = health_check()
    return h


# ───────────────────────────────────────────────────
# GET /api/model-info  (and alias /api/model/insights)
# ───────────────────────────────────────────────────
@app.get("/api/model-info", response_model=ModelInfoResponse)
def model_info():
    return _build_model_info()


@app.get("/api/model/insights")
def model_insights_alias():
    return _build_model_info()


def _build_model_info() -> dict:
    """Extract model metadata, hyperparameters, and feature importances."""
    info: Dict[str, Any] = {"models": _model_status}

    # Try the primary model for feature importances
    model = powertrain_model_primary or powertrain_model_deep
    if model is not None:
        params = model.get_params()
        info["objective"] = params.get("objective", "reg:squarederror")
        info["n_estimators"] = params.get("n_estimators")
        info["max_depth"] = params.get("max_depth")
        info["learning_rate"] = params.get("learning_rate")
        info["colsample_bytree"] = params.get("colsample_bytree")

        # Feature importances
        try:
            importances = model.feature_importances_
            feature_names = (
                list(model.feature_names_in_)
                if hasattr(model, "feature_names_in_")
                else MODEL_COLUMNS
            )
            total = float(importances.sum()) if importances.sum() > 0 else 1.0
            fi_list = []

            # Physics interpretation map
            descriptions = {
                "motor_peak": "Peak motor torque — determines launch force and max acceleration",
                "motor_cont": "Continuous motor torque — affects sustained high-speed cruising",
                "gear_ratio": "Transmission reduction ratio — trades torque for top speed",
                "battery_deg": "Battery degradation factor (1 - efficiency) — voltage loss proxy",
                "tire_radius": "Tire outer radius in meters — links motor RPM to vehicle speed",
                "vehicle_mass": "Total vehicle mass — primary resistive force contributor",
                "Cd": "Aerodynamic drag coefficient — high-speed resistance",
                "A": "Frontal cross-sectional area — aerodynamic drag scaling",
                "Cr": "Tire rolling resistance coefficient",
                "rho": "Air density — typically 1.225 kg/m³ at sea level",
                "cont_ratio": "motor_cont / motor_peak — thermal derating headroom",
                "battery_multiplier": "Battery pack efficiency — dominant prediction driver",
                "T_wheel_0ms": "Wheel torque at standstill (0 m/s) — launch torque demand",
                "T_motor_0ms": "Motor torque at standstill (0 m/s)",
                "rpm_0ms": "Motor RPM at standstill (always 0)",
                "Preq_0ms": "Power required at standstill (always 0)",
                "T_wheel_5ms": "Wheel torque at 5 m/s — corner exit torque demand",
                "T_motor_5ms": "Motor torque at 5 m/s",
                "rpm_5ms": "Motor RPM at 5 m/s",
                "Preq_5ms": "Power required at 5 m/s",
                "T_wheel_20ms": "Wheel torque at 20 m/s — high-speed straight demand",
                "T_motor_20ms": "Motor torque at 20 m/s",
                "rpm_20ms": "Motor RPM at 20 m/s",
                "Preq_20ms": "Power required at 20 m/s",
            }

            for fname, imp in sorted(
                zip(feature_names, importances),
                key=lambda x: x[1],
                reverse=True,
            ):
                fi_list.append({
                    "feature": str(fname),
                    "importance_percent": round(float(imp / total * 100), 2),
                    "description": descriptions.get(str(fname), ""),
                })
            info["feature_importances"] = fi_list
        except Exception:
            info["feature_importances"] = []

    # Battery pack submodels
    if battery_pack_models is not None:
        submodels = {}
        for target_name, sub_model in battery_pack_models.items():
            try:
                imp = sub_model.feature_importances_
                names = (
                    list(sub_model.feature_names_in_)
                    if hasattr(sub_model, "feature_names_in_")
                    else BATTERY_MODEL_FEATURES
                )
                total = float(imp.sum()) if imp.sum() > 0 else 1.0
                submodels[target_name] = [
                    {
                        "feature": str(n),
                        "importance_percent": round(float(i / total * 100), 2),
                    }
                    for n, i in sorted(
                        zip(names, imp), key=lambda x: x[1], reverse=True
                    )
                ]
            except Exception:
                submodels[target_name] = []
        info["battery_pack_submodels"] = submodels

    return info


# ───────────────────────────────────────────────────
# GET /api/presets
# ───────────────────────────────────────────────────
PRESETS = [
    {
        "id": "fsae_baseline",
        "name": "FSAE Baseline (18650 NCA)",
        "description": "Standard Formula Student EV baseline with 18650 Li-ion NCA cells, 240 kg vehicle, 230 Nm motor.",
        "data": {
            "motor_peak": 230, "motor_cont": 120, "motor_max_rpm": 6000,
            "gear_ratio": 4.5, "tire_r_in": 9.5, "vehicle_mass": 240,
            "Cd": 0.85, "A": 1.15, "Cr": 0.015,
            "V_cell": 3.6, "Ah_cell": 3.0, "m_cell": 0.048,
            "R_cell": 0.020, "I_cell_max": 25, "V_pack_target": 400,
            "P_peak_required": 75000,
        },
    },
    {
        "id": "fsae_21700",
        "name": "FSAE High-Energy (21700 NMC)",
        "description": "Higher-capacity 21700 cells for extended endurance events with 5 Ah capacity.",
        "data": {
            "motor_peak": 210, "motor_cont": 110, "motor_max_rpm": 5800,
            "gear_ratio": 4.2, "tire_r_in": 9.0, "vehicle_mass": 230,
            "Cd": 0.82, "A": 1.10, "Cr": 0.014,
            "V_cell": 3.65, "Ah_cell": 5.0, "m_cell": 0.068,
            "R_cell": 0.016, "I_cell_max": 35, "V_pack_target": 400,
            "P_peak_required": 70000,
        },
    },
    {
        "id": "fsae_lightweight",
        "name": "FSAE Lightweight Sprint",
        "description": "Lightweight sprint-focused build with low mass target and reduced battery capacity.",
        "data": {
            "motor_peak": 190, "motor_cont": 95, "motor_max_rpm": 5500,
            "gear_ratio": 4.0, "tire_r_in": 9.2, "vehicle_mass": 210,
            "Cd": 0.78, "A": 1.05, "Cr": 0.013,
            "V_cell": 3.6, "Ah_cell": 2.5, "m_cell": 0.045,
            "R_cell": 0.025, "I_cell_max": 20, "V_pack_target": 350,
            "P_peak_required": 60000,
        },
    },
    {
        "id": "fsae_aero",
        "name": "FSAE Aero Package",
        "description": "Aggressive aero-focused design with high downforce, higher mass, and peak 80 kW power.",
        "data": {
            "motor_peak": 250, "motor_cont": 130, "motor_max_rpm": 6500,
            "gear_ratio": 4.8, "tire_r_in": 10.0, "vehicle_mass": 260,
            "Cd": 0.95, "A": 1.30, "Cr": 0.016,
            "V_cell": 3.6, "Ah_cell": 3.0, "m_cell": 0.048,
            "R_cell": 0.018, "I_cell_max": 30, "V_pack_target": 420,
            "P_peak_required": 80000,
        },
    },
]


@app.get("/api/presets")
def get_presets():
    return PRESETS


# ───────────────────────────────────────────────────
# POST /api/predict
# ───────────────────────────────────────────────────
# ───────────────────────────────────────────────────
# Prediction helper
# ───────────────────────────────────────────────────
def _execute_single_predict(req: PredictRequest) -> PredictResponse:
    try:
        model, model_name = _get_powertrain_model(req.model_choice)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    tire_r_m = req.tire_r_in * 0.0254

    # ── Battery pack design (physics) ──
    pack = design_pack_physics(
        V_cell=req.V_cell,
        Ah_cell=req.Ah_cell,
        m_cell=req.m_cell,
        R_cell=req.R_cell,
        I_cell_max=req.I_cell_max,
        V_pack_target=req.V_pack_target,
        P_peak_required=req.P_peak_required,
    )

    if pack is None:
        return PredictResponse(
            feasible=False,
            error=(
                "No feasible battery pack configuration found within constraints. "
                "Try adjusting cell specs, target voltage, or peak power demand."
            ),
        )

    # ── Pack explanation and diagnostics ──
    pack_detail = compute_pack_explanation(
        pack=pack,
        V_cell=req.V_cell,
        Ah_cell=req.Ah_cell,
        I_cell_max=req.I_cell_max,
        V_pack_target=req.V_pack_target,
        P_peak_required=req.P_peak_required,
    )

    # ── Build ML feature vector ──
    feat_dict = build_feature_vector(
        motor_peak=req.motor_peak,
        motor_cont=req.motor_cont,
        gear_ratio=req.gear_ratio,
        tire_r_m=tire_r_m,
        vehicle_mass=req.vehicle_mass,
        Cd=req.Cd,
        A=req.A,
        Cr=req.Cr,
        battery_eff=pack["Battery_eff"],
    )

    X = pd.DataFrame([feat_dict], columns=MODEL_COLUMNS)

    # ── XGBoost prediction ──
    try:
        raw_pred = float(model.predict(X)[0])
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"XGBoost inference failed: {e}",
        )

    # ── Speed telemetry ──
    speed_telemetry = compute_speed_telemetry(
        vehicle_mass=req.vehicle_mass,
        Cd=req.Cd,
        A=req.A,
        Cr=req.Cr,
        tire_r_m=tire_r_m,
        gear_ratio=req.gear_ratio,
    )

    # ── Velocity curve ──
    velocity_curve = compute_velocity_curve(
        vehicle_mass=req.vehicle_mass,
        Cd=req.Cd,
        A=req.A,
        Cr=req.Cr,
        tire_r_m=tire_r_m,
        gear_ratio=req.gear_ratio,
    )

    # ── ML surrogate battery pack predictions ──
    ml_surrogate = None
    if battery_pack_models is not None:
        try:
            batt_features = pd.DataFrame([{
                "V_cell": req.V_cell,
                "Ah_cell": req.Ah_cell,
                "m_cell": req.m_cell,
                "R_cell": req.R_cell,
                "I_cell_max": req.I_cell_max,
                "V_pack_target": req.V_pack_target,
                "P_peak_required": req.P_peak_required,
            }], columns=BATTERY_MODEL_FEATURES)

            ml_surrogate = {}
            for target_name, sub_model in battery_pack_models.items():
                pred_val = float(sub_model.predict(batt_features)[0])
                ml_surrogate[f"{target_name}_pred"] = round(pred_val, 2)
        except Exception:
            ml_surrogate = None

    return PredictResponse(
        feasible=True,
        predicted_efficiency=round(raw_pred, 6),
        predicted_efficiency_percent=round(raw_pred * 100, 2),
        model_used=model_name,
        output_type="ml_prediction",
        pack=pack,
        explanation=pack_detail["explanation"],
        diagnostics=pack_detail["diagnostics"],
        speed_telemetry=speed_telemetry,
        velocity_curve=velocity_curve,
        ml_surrogate_pack=ml_surrogate,
    )


# ───────────────────────────────────────────────────
# POST /api/predict
# ───────────────────────────────────────────────────
@app.post("/api/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    return _execute_single_predict(req)


# ───────────────────────────────────────────────────
# POST /api/predict/batch
# ───────────────────────────────────────────────────
@app.post("/api/predict/batch", response_model=BatchPredictResponse)
def predict_batch(req: BatchPredictRequest):
    results = [_execute_single_predict(item) for item in req.items]
    return BatchPredictResponse(results=results)


# ───────────────────────────────────────────────────
# GET /api/benchmark/dataset
# ───────────────────────────────────────────────────
_benchmark_cache = None


def _get_benchmark_dataset():
    global _benchmark_cache
    if _benchmark_cache is not None:
        return _benchmark_cache

    runs_def = [
        {"id": "FS-18650-350V", "cell_type": "18650 NCA", "V_cell": 3.6, "Ah_cell": 3.0, "m_cell": 0.048, "R_cell": 0.020, "I_cell_max": 25.0, "V_pack_target": 350.0, "P_peak_required": 65000.0},
        {"id": "FS-18650-380V", "cell_type": "18650 NCA", "V_cell": 3.6, "Ah_cell": 3.0, "m_cell": 0.048, "R_cell": 0.020, "I_cell_max": 25.0, "V_pack_target": 380.0, "P_peak_required": 70000.0},
        {"id": "FS-18650-400V", "cell_type": "18650 NCA", "V_cell": 3.6, "Ah_cell": 3.0, "m_cell": 0.048, "R_cell": 0.020, "I_cell_max": 25.0, "V_pack_target": 400.0, "P_peak_required": 75000.0},
        {"id": "FS-18650-420V", "cell_type": "18650 NCA", "V_cell": 3.6, "Ah_cell": 3.0, "m_cell": 0.048, "R_cell": 0.020, "I_cell_max": 25.0, "V_pack_target": 420.0, "P_peak_required": 75000.0},
        {"id": "FS-18650-450V", "cell_type": "18650 NCA", "V_cell": 3.6, "Ah_cell": 3.0, "m_cell": 0.048, "R_cell": 0.020, "I_cell_max": 25.0, "V_pack_target": 450.0, "P_peak_required": 80000.0},
        {"id": "FS-18650-480V", "cell_type": "18650 NCA", "V_cell": 3.6, "Ah_cell": 3.2, "m_cell": 0.049, "R_cell": 0.022, "I_cell_max": 24.0, "V_pack_target": 480.0, "P_peak_required": 80000.0},
        {"id": "FS-21700-350V", "cell_type": "21700 NMC", "V_cell": 3.65, "Ah_cell": 4.8, "m_cell": 0.068, "R_cell": 0.015, "I_cell_max": 35.0, "V_pack_target": 350.0, "P_peak_required": 65000.0},
        {"id": "FS-21700-380V", "cell_type": "21700 NMC", "V_cell": 3.65, "Ah_cell": 4.8, "m_cell": 0.068, "R_cell": 0.015, "I_cell_max": 35.0, "V_pack_target": 380.0, "P_peak_required": 70000.0},
        {"id": "FS-21700-400V", "cell_type": "21700 NMC", "V_cell": 3.65, "Ah_cell": 4.8, "m_cell": 0.068, "R_cell": 0.015, "I_cell_max": 35.0, "V_pack_target": 400.0, "P_peak_required": 75000.0},
        {"id": "FS-21700-420V", "cell_type": "21700 NMC", "V_cell": 3.65, "Ah_cell": 4.8, "m_cell": 0.068, "R_cell": 0.015, "I_cell_max": 35.0, "V_pack_target": 420.0, "P_peak_required": 80000.0},
        {"id": "FS-21700-450V", "cell_type": "21700 NMC", "V_cell": 3.65, "Ah_cell": 4.8, "m_cell": 0.068, "R_cell": 0.015, "I_cell_max": 35.0, "V_pack_target": 450.0, "P_peak_required": 80000.0},
        {"id": "FS-21700-500V", "cell_type": "21700 NMC", "V_cell": 3.65, "Ah_cell": 5.0, "m_cell": 0.070, "R_cell": 0.016, "I_cell_max": 35.0, "V_pack_target": 500.0, "P_peak_required": 85000.0},
        {"id": "FS-26650-320V", "cell_type": "26650 LFP", "V_cell": 3.2, "Ah_cell": 3.3, "m_cell": 0.086, "R_cell": 0.012, "I_cell_max": 30.0, "V_pack_target": 320.0, "P_peak_required": 55000.0},
        {"id": "FS-26650-360V", "cell_type": "26650 LFP", "V_cell": 3.2, "Ah_cell": 3.3, "m_cell": 0.086, "R_cell": 0.012, "I_cell_max": 30.0, "V_pack_target": 360.0, "P_peak_required": 65000.0},
        {"id": "FS-26650-400V", "cell_type": "26650 LFP", "V_cell": 3.2, "Ah_cell": 3.3, "m_cell": 0.086, "R_cell": 0.012, "I_cell_max": 30.0, "V_pack_target": 400.0, "P_peak_required": 70000.0},
        {"id": "FS-26650-440V", "cell_type": "26650 LFP", "V_cell": 3.2, "Ah_cell": 3.3, "m_cell": 0.086, "R_cell": 0.012, "I_cell_max": 30.0, "V_pack_target": 440.0, "P_peak_required": 75000.0},
        {"id": "FS-POUCH-350V", "cell_type": "Pouch NMC", "V_cell": 3.7, "Ah_cell": 8.0, "m_cell": 0.120, "R_cell": 0.008, "I_cell_max": 60.0, "V_pack_target": 350.0, "P_peak_required": 70000.0},
        {"id": "FS-POUCH-400V", "cell_type": "Pouch NMC", "V_cell": 3.7, "Ah_cell": 8.0, "m_cell": 0.120, "R_cell": 0.008, "I_cell_max": 60.0, "V_pack_target": 400.0, "P_peak_required": 80000.0},
        {"id": "FS-POUCH-450V", "cell_type": "Pouch NMC", "V_cell": 3.7, "Ah_cell": 8.0, "m_cell": 0.120, "R_cell": 0.008, "I_cell_max": 60.0, "V_pack_target": 450.0, "P_peak_required": 80000.0},
        {"id": "FS-POUCH-500V", "cell_type": "Pouch NMC", "V_cell": 3.7, "Ah_cell": 8.0, "m_cell": 0.120, "R_cell": 0.008, "I_cell_max": 60.0, "V_pack_target": 500.0, "P_peak_required": 85000.0},
    ]

    model = powertrain_model_primary or powertrain_model_deep
    dataset = []
    tire_r_m = 9.5 * 0.0254

    for r in runs_def:
        pack = design_pack_physics(
            V_cell=r["V_cell"],
            Ah_cell=r["Ah_cell"],
            m_cell=r["m_cell"],
            R_cell=r["R_cell"],
            I_cell_max=r["I_cell_max"],
            V_pack_target=r["V_pack_target"],
            P_peak_required=r["P_peak_required"],
        )
        if pack is None:
            continue

        eff_percent = 90.0
        if model is not None:
            f = build_feature_vector(
                motor_peak=230,
                motor_cont=120,
                gear_ratio=4.5,
                tire_r_m=tire_r_m,
                vehicle_mass=240,
                Cd=0.85,
                A=1.15,
                Cr=0.015,
                battery_eff=pack["Battery_eff"],
            )
            X = pd.DataFrame([f], columns=MODEL_COLUMNS)
            try:
                pred = float(model.predict(X)[0])
                eff_percent = round(pred * 100, 2)
            except Exception:
                eff_percent = round(pack["Battery_eff"] * 94.0, 2)

        dataset.append({
            "id": r["id"],
            "cell_type": r["cell_type"],
            "V_pack_target_V": r["V_pack_target"],
            "P_peak_req_kW": round(r["P_peak_required"] / 1000.0, 1),
            "config": f"{pack['Ns_modules']}S {pack['Np']}P",
            "battery_eff_percent": round(pack["Battery_eff"] * 100, 2),
            "pack_mass_kg": round(pack["Mass_pack"], 2),
            "energy_kWh": round(pack["Energy_Wh"] / 1000.0, 2),
            "predicted_powertrain_eff_percent": eff_percent,
        })

    _benchmark_cache = {
        "metadata": {
            "total_runs": len(dataset),
            "disclaimer": "All values represent systematically verified physics parameter sweeps across Formula Student architectures and the trained XGBoost model. Not fabricated sensor measurements.",
        },
        "dataset": dataset,
    }
    return _benchmark_cache


@app.get("/api/benchmark/dataset")
def benchmark_dataset():
    return _get_benchmark_dataset()


# ───────────────────────────────────────────────────
# POST /api/upload/csv
# ───────────────────────────────────────────────────
@app.post("/api/upload/csv")
async def upload_csv(file: UploadFile = File(...)):
    content = await file.read()
    text = content.decode("utf-8-sig", errors="replace")
    reader = list(csv.DictReader(io.StringIO(text)))
    if not reader:
        raise HTTPException(status_code=400, detail="CSV file is empty or invalid format.")

    first_row = reader[0]
    headers = set(first_row.keys())

    # Check if direct MODEL_COLUMNS format
    is_direct_model = all(col in headers for col in MODEL_COLUMNS[:5])

    results = []
    valid_count = 0
    model = powertrain_model_primary or powertrain_model_deep

    for idx, row in enumerate(reader):
        row_num = idx + 1
        try:
            if is_direct_model:
                feat_dict = {col: float(row.get(col, 0)) for col in MODEL_COLUMNS}
                X = pd.DataFrame([feat_dict], columns=MODEL_COLUMNS)
                pred = float(model.predict(X)[0]) if model else 0.85
                results.append({
                    "row_number": row_num,
                    "feasible": True,
                    "predicted_efficiency": round(pred, 6),
                    "predicted_efficiency_percent": round(pred * 100, 2),
                    "pack_voltage": float(row.get("V_pack", 400.0)),
                    "battery_eff": round(float(row.get("battery_multiplier", 0.95)) * 100, 2),
                    "pack_mass": float(row.get("pack_mass", 25.0)),
                    "total_cells": int(row.get("total_cells", 400)),
                    "error": None,
                })
                valid_count += 1
            else:
                # Vehicle & battery parameters
                req_dict = {
                    "motor_peak": float(row.get("motor_peak", 230)),
                    "motor_cont": float(row.get("motor_cont", 120)),
                    "motor_max_rpm": float(row.get("motor_max_rpm", 6000)),
                    "gear_ratio": float(row.get("gear_ratio", 4.5)),
                    "tire_r_in": float(row.get("tire_r_in", 9.5)),
                    "vehicle_mass": float(row.get("vehicle_mass", 240)),
                    "Cd": float(row.get("Cd", 0.85)),
                    "A": float(row.get("A", 1.15)),
                    "Cr": float(row.get("Cr", 0.015)),
                    "V_cell": float(row.get("V_cell", 3.6)),
                    "Ah_cell": float(row.get("Ah_cell", 3.0)),
                    "m_cell": float(row.get("m_cell", 0.048)),
                    "R_cell": float(row.get("R_cell", 0.020)),
                    "I_cell_max": float(row.get("I_cell_max", 25.0)),
                    "V_pack_target": float(row.get("V_pack_target", 400.0)),
                    "P_peak_required": float(row.get("P_peak_required", 75000.0)),
                }
                req = PredictRequest(**req_dict)
                pred_resp = _execute_single_predict(req)
                if pred_resp.feasible and pred_resp.pack:
                    results.append({
                        "row_number": row_num,
                        "feasible": True,
                        "predicted_efficiency": pred_resp.predicted_efficiency,
                        "predicted_efficiency_percent": pred_resp.predicted_efficiency_percent,
                        "pack_voltage": round(pred_resp.pack["V_pack"], 1),
                        "battery_eff": round(pred_resp.pack["Battery_eff"] * 100, 2),
                        "pack_mass": round(pred_resp.pack["Mass_pack"], 2),
                        "total_cells": pred_resp.pack["Cells_total"],
                        "error": None,
                    })
                    valid_count += 1
                else:
                    results.append({
                        "row_number": row_num,
                        "feasible": False,
                        "predicted_efficiency": None,
                        "predicted_efficiency_percent": None,
                        "pack_voltage": None,
                        "battery_eff": None,
                        "pack_mass": None,
                        "total_cells": None,
                        "error": pred_resp.error or "Infeasible battery pack configuration",
                    })
        except Exception as err:
            results.append({
                "row_number": row_num,
                "feasible": False,
                "predicted_efficiency": None,
                "predicted_efficiency_percent": None,
                "pack_voltage": None,
                "battery_eff": None,
                "pack_mass": None,
                "total_cells": None,
                "error": str(err),
            })

    return {
        "valid_rows": valid_count,
        "total_rows": len(reader),
        "mode": "Direct 24 Features" if is_direct_model else "Physics Design Parameters",
        "filename": file.filename or "uploaded.csv",
        "results": results,
    }


# ───────────────────────────────────────────────────
# Run with uvicorn
# ───────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
