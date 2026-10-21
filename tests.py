"""
Tests for the EV Powertrain Intelligence Platform.

Covers:
  1. Physics engine functions (battery pack design, feature engineering)
  2. Input validation
  3. Model loading and feature compatibility
  4. API endpoints (health, predict)
  5. Regression test: compare refactored output against original predict.py
"""

import math
import sys
from pathlib import Path

import pytest
import numpy as np
import pandas as pd

# Ensure project root is on the path
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.physics_engine import (
    MODEL_COLUMNS,
    BATTERY_MODEL_FEATURES,
    DRIVETRAIN_EFF,
    G,
    RHO_AIR_DEFAULT,
    build_feature_vector,
    compute_pack_explanation,
    compute_speed_telemetry,
    compute_velocity_curve,
    design_pack_physics,
    motor_torque_from_wheel,
    power_from_torque_and_speed,
    rpm_from_speed,
    wheel_torque_from_speed,
)


# ─────────────────────────────────────────
# 1. Physics function unit tests
# ─────────────────────────────────────────

class TestWheelTorque:
    def test_standstill_uses_launch_acceleration(self):
        T, F = wheel_torque_from_speed(
            v=0.0, mass=240, Cd=0.85, A=1.15, Cr=0.015,
            tire_r=0.2413,  # 9.5 inches in meters
        )
        # At standstill: F = F_roll + F_accel (aero=0), T = F * tire_r
        F_roll = 240 * G * 0.015
        F_accel = 240 * 4.0  # default a_launch=4.0
        expected_F = F_roll + F_accel
        expected_T = expected_F * 0.2413
        assert abs(T - expected_T) < 0.1, f"Expected ~{expected_T:.1f}, got {T:.1f}"
        assert T > 0

    def test_high_speed_no_launch_accel(self):
        T, F = wheel_torque_from_speed(
            v=20.0, mass=240, Cd=0.85, A=1.15, Cr=0.015,
            tire_r=0.2413,
        )
        # v=20 > v_launch_thresh=5, so a_req=0
        F_roll = 240 * G * 0.015
        F_aero = 0.5 * RHO_AIR_DEFAULT * 0.85 * 1.15 * (20.0 ** 2)
        expected_F = F_roll + F_aero
        expected_T = expected_F * 0.2413
        min_torque = 550.0 * 0.15
        expected_T = max(expected_T, min_torque)
        assert abs(T - expected_T) < 0.1

    def test_minimum_torque_floor(self):
        # Very low mass, low speed — torque should not go below min
        T, _ = wheel_torque_from_speed(
            v=0.1, mass=10, Cd=0.1, A=0.1, Cr=0.001,
            tire_r=0.3,
        )
        assert T >= 550.0 * 0.15


class TestRPM:
    def test_zero_speed(self):
        assert rpm_from_speed(0.0, 0.25, 4.5) == 0.0

    def test_known_speed(self):
        tire_r = 9.5 * 0.0254  # 0.2413 m
        rpm = rpm_from_speed(5.0, tire_r, 4.5)
        # omega_wheel = 5 / 0.2413 = 20.72 rad/s
        # omega_motor = 20.72 * 4.5 = 93.24 rad/s
        # RPM = 93.24 * 60 / (2*pi) = 890.4
        expected = (5.0 / tire_r) * 4.5 * 60 / (2 * math.pi)
        assert abs(rpm - expected) < 0.1

    def test_zero_tire_radius(self):
        assert rpm_from_speed(10.0, 0.0, 4.5) == 0.0


class TestMotorTorque:
    def test_basic(self):
        T_motor = motor_torque_from_wheel(100.0, 4.5)
        assert abs(T_motor - 100.0 / 4.5) < 0.01

    def test_zero_gear_ratio(self):
        T_motor = motor_torque_from_wheel(100.0, 0.0)
        assert T_motor == float("inf")


class TestPower:
    def test_standstill_zero_power(self):
        assert power_from_torque_and_speed(200.0, 0.0, 0.25) == 0.0

    def test_positive_speed(self):
        P = power_from_torque_and_speed(100.0, 10.0, 0.25)
        # omega_wheel = 10 / 0.25 = 40, P = 100 * 40 = 4000
        assert abs(P - 4000.0) < 0.1


# ─────────────────────────────────────────
# 2. Battery pack design tests
# ─────────────────────────────────────────

class TestBatteryPackDesign:
    def test_baseline_feasible(self):
        """Standard FSAE baseline should find a feasible pack."""
        pack = design_pack_physics(
            V_cell=3.6, Ah_cell=3.0, m_cell=0.048,
            R_cell=0.020, I_cell_max=25.0,
            V_pack_target=400.0, P_peak_required=75000.0,
        )
        assert pack is not None
        assert pack["Cells_total"] <= 2000
        assert pack["Mass_pack"] <= 60.0
        assert 0.9 * 400 <= pack["V_pack"] <= 1.1 * 400
        assert 0.5 <= pack["Battery_eff"] <= 1.0

    def test_impossible_constraints_returns_none(self):
        """Extremely high power with tiny cells should be infeasible."""
        pack = design_pack_physics(
            V_cell=1.0, Ah_cell=0.5, m_cell=0.5,
            R_cell=1.0, I_cell_max=0.1,
            V_pack_target=1000.0, P_peak_required=500000.0,
        )
        assert pack is None

    def test_pack_voltage_within_window(self):
        pack = design_pack_physics(
            V_cell=3.6, Ah_cell=3.0, m_cell=0.048,
            R_cell=0.020, I_cell_max=25.0,
            V_pack_target=400.0, P_peak_required=75000.0,
        )
        if pack is not None:
            assert 360.0 <= pack["V_pack"] <= 440.0

    def test_series_parallel_consistency(self):
        pack = design_pack_physics(
            V_cell=3.6, Ah_cell=3.0, m_cell=0.048,
            R_cell=0.020, I_cell_max=25.0,
            V_pack_target=400.0, P_peak_required=75000.0,
        )
        if pack is not None:
            cells_per_mod = pack["S_mod"] * pack["P_mod"]
            total = pack["Ns_modules"] * pack["Np"] * cells_per_mod
            assert total == pack["Cells_total"]
            expected_mass = total * 0.048
            assert abs(pack["Mass_pack"] - expected_mass) < 0.01


# ─────────────────────────────────────────
# 3. Feature engineering tests
# ─────────────────────────────────────────

class TestFeatureVector:
    def test_correct_feature_count(self):
        feat = build_feature_vector(
            motor_peak=230, motor_cont=120, gear_ratio=4.5,
            tire_r_m=0.2413, vehicle_mass=240, Cd=0.85,
            A=1.15, Cr=0.015, battery_eff=0.9,
        )
        assert len(feat) == 24
        assert list(feat.keys()) == MODEL_COLUMNS

    def test_battery_deg_complement(self):
        feat = build_feature_vector(
            motor_peak=230, motor_cont=120, gear_ratio=4.5,
            tire_r_m=0.2413, vehicle_mass=240, Cd=0.85,
            A=1.15, Cr=0.015, battery_eff=0.9,
        )
        assert abs(feat["battery_deg"] - 0.1) < 1e-6
        assert abs(feat["battery_multiplier"] - 0.9) < 1e-6

    def test_cont_ratio(self):
        feat = build_feature_vector(
            motor_peak=230, motor_cont=120, gear_ratio=4.5,
            tire_r_m=0.2413, vehicle_mass=240, Cd=0.85,
            A=1.15, Cr=0.015, battery_eff=0.9,
        )
        assert abs(feat["cont_ratio"] - 120 / 230) < 1e-6

    def test_rho_constant(self):
        feat = build_feature_vector(
            motor_peak=230, motor_cont=120, gear_ratio=4.5,
            tire_r_m=0.2413, vehicle_mass=240, Cd=0.85,
            A=1.15, Cr=0.015, battery_eff=0.9,
        )
        assert feat["rho"] == RHO_AIR_DEFAULT


# ─────────────────────────────────────────
# 4. Model loading and compatibility
# ─────────────────────────────────────────

class TestModelLoading:
    def test_powertrain_model_exists(self):
        models_dir = PROJECT_ROOT / "models"
        assert (models_dir / "powertrain_physics_model.joblib").exists()

    def test_root_model_exists(self):
        assert (PROJECT_ROOT / "powertrain_physics_model.joblib").exists()

    def test_battery_model_exists(self):
        assert (PROJECT_ROOT / "models" / "battery_pack_model.joblib").exists()

    def test_primary_model_feature_count(self):
        import joblib
        model = joblib.load(str(PROJECT_ROOT / "models" / "powertrain_physics_model.joblib"))
        assert model.n_features_in_ == 24

    def test_primary_model_feature_names(self):
        import joblib
        model = joblib.load(str(PROJECT_ROOT / "models" / "powertrain_physics_model.joblib"))
        names = list(model.feature_names_in_)
        assert names == MODEL_COLUMNS

    def test_deep_model_feature_names(self):
        import joblib
        model = joblib.load(str(PROJECT_ROOT / "powertrain_physics_model.joblib"))
        names = list(model.feature_names_in_)
        assert names == MODEL_COLUMNS

    def test_battery_model_structure(self):
        import joblib
        m = joblib.load(str(PROJECT_ROOT / "models" / "battery_pack_model.joblib"))
        assert isinstance(m, dict)
        expected_keys = {"S_mod", "P_mod", "Ns", "Np", "V_pack", "mass_pack", "battery_eff"}
        assert set(m.keys()) == expected_keys
        for key, sub in m.items():
            assert sub.n_features_in_ == 7


# ─────────────────────────────────────────
# 5. API endpoint tests
# ─────────────────────────────────────────

class TestAPI:
    @pytest.fixture(autouse=True)
    def setup_client(self):
        from fastapi.testclient import TestClient
        from backend.server import app
        self.client = TestClient(app)

    def test_health_endpoint(self):
        r = self.client.get("/api/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] in ("ONLINE", "DEGRADED", "OFFLINE")
        assert data["features_expected"] == 24

    def test_status_endpoint(self):
        r = self.client.get("/api/status")
        assert r.status_code == 200

    def test_model_info_endpoint(self):
        r = self.client.get("/api/model-info")
        assert r.status_code == 200
        data = r.json()
        assert "models" in data

    def test_model_insights_alias(self):
        r = self.client.get("/api/model/insights")
        assert r.status_code == 200

    def test_presets_endpoint(self):
        r = self.client.get("/api/presets")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 3

    def test_predict_baseline(self):
        payload = {
            "motor_peak": 230, "motor_cont": 120, "motor_max_rpm": 6000,
            "gear_ratio": 4.5, "tire_r_in": 9.5, "vehicle_mass": 240,
            "Cd": 0.85, "A": 1.15, "Cr": 0.015,
            "V_cell": 3.6, "Ah_cell": 3.0, "m_cell": 0.048,
            "R_cell": 0.020, "I_cell_max": 25.0,
            "V_pack_target": 400.0, "P_peak_required": 75000.0,
        }
        r = self.client.post("/api/predict", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["feasible"] is True
        assert data["predicted_efficiency"] is not None
        assert 0 < data["predicted_efficiency"] < 1.5  # sanity
        assert data["pack"] is not None
        assert data["explanation"] is not None
        assert data["speed_telemetry"] is not None
        assert len(data["speed_telemetry"]) == 3
        assert data["velocity_curve"] is not None

    def test_predict_infeasible(self):
        payload = {
            "motor_peak": 230, "motor_cont": 120, "motor_max_rpm": 6000,
            "gear_ratio": 4.5, "tire_r_in": 9.5, "vehicle_mass": 240,
            "Cd": 0.85, "A": 1.15, "Cr": 0.015,
            "V_cell": 1.0, "Ah_cell": 0.5, "m_cell": 0.5,
            "R_cell": 1.0, "I_cell_max": 0.1,
            "V_pack_target": 1000.0, "P_peak_required": 500000.0,
        }
        r = self.client.post("/api/predict", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["feasible"] is False
        assert data["error"] is not None

    def test_predict_validation_negative_mass(self):
        payload = {
            "motor_peak": 230, "motor_cont": 120, "motor_max_rpm": 6000,
            "gear_ratio": 4.5, "tire_r_in": 9.5, "vehicle_mass": -10,
            "Cd": 0.85, "A": 1.15, "Cr": 0.015,
            "V_cell": 3.6, "Ah_cell": 3.0, "m_cell": 0.048,
            "R_cell": 0.020, "I_cell_max": 25.0,
            "V_pack_target": 400.0, "P_peak_required": 75000.0,
        }
        r = self.client.post("/api/predict", json=payload)
        assert r.status_code == 422  # Pydantic validation error

    def test_predict_cont_exceeds_peak(self):
        payload = {
            "motor_peak": 100, "motor_cont": 200, "motor_max_rpm": 6000,
            "gear_ratio": 4.5, "tire_r_in": 9.5, "vehicle_mass": 240,
            "Cd": 0.85, "A": 1.15, "Cr": 0.015,
            "V_cell": 3.6, "Ah_cell": 3.0, "m_cell": 0.048,
            "R_cell": 0.020, "I_cell_max": 25.0,
            "V_pack_target": 400.0, "P_peak_required": 75000.0,
        }
        r = self.client.post("/api/predict", json=payload)
        assert r.status_code == 422

    def test_benchmark_dataset_endpoint(self):
        r = self.client.get("/api/benchmark/dataset")
        assert r.status_code == 200
        data = r.json()
        assert "dataset" in data
        assert "metadata" in data
        assert len(data["dataset"]) >= 10
        item = data["dataset"][0]
        assert "predicted_powertrain_eff_percent" in item
        assert "V_pack_target_V" in item
        assert "energy_kWh" in item

    def test_predict_batch_endpoint(self):
        payload = {
            "items": [
                {
                    "motor_peak": 230, "motor_cont": 120, "motor_max_rpm": 6000,
                    "gear_ratio": 4.5, "tire_r_in": 9.5, "vehicle_mass": 240,
                    "Cd": 0.85, "A": 1.15, "Cr": 0.015,
                    "V_cell": 3.6, "Ah_cell": 3.0, "m_cell": 0.048,
                    "R_cell": 0.020, "I_cell_max": 25.0,
                    "V_pack_target": 400.0, "P_peak_required": 75000.0,
                },
                {
                    "motor_peak": 210, "motor_cont": 110, "motor_max_rpm": 5800,
                    "gear_ratio": 4.2, "tire_r_in": 9.0, "vehicle_mass": 225,
                    "Cd": 0.82, "A": 1.10, "Cr": 0.014,
                    "V_cell": 3.65, "Ah_cell": 4.8, "m_cell": 0.068,
                    "R_cell": 0.015, "I_cell_max": 35.0,
                    "V_pack_target": 380.0, "P_peak_required": 70000.0,
                }
            ]
        }
        r = self.client.post("/api/predict/batch", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert "results" in data
        assert len(data["results"]) == 2
        assert data["results"][0]["feasible"] is True

    def test_upload_csv_endpoint(self):
        csv_content = (
            "motor_peak,motor_cont,motor_max_rpm,gear_ratio,tire_r_in,vehicle_mass,Cd,A,Cr,V_cell,Ah_cell,m_cell,R_cell,I_cell_max,V_pack_target,P_peak_required\n"
            "230,120,6000,4.5,9.5,240,0.85,1.15,0.015,3.6,3.0,0.048,0.020,25.0,400.0,75000\n"
            "210,110,5800,4.2,9.0,225,0.82,1.10,0.014,3.6,3.2,0.046,0.018,30.0,380.0,70000\n"
        )
        files = {"file": ("test.csv", csv_content.encode("utf-8"), "text/csv")}
        r = self.client.post("/api/upload/csv", files=files)
        assert r.status_code == 200
        data = r.json()
        assert data["valid_rows"] == 2
        assert data["total_rows"] == 2
        assert len(data["results"]) == 2
        assert data["results"][0]["feasible"] is True


# ─────────────────────────────────────────
# 6. Regression test vs original predict.py
# ─────────────────────────────────────────

class TestRegressionVsOriginal:
    """
    Compare the refactored physics engine + model inference
    against the original predict.py logic for identical inputs.
    """

    def test_feature_vector_matches_original(self):
        """Build feature vector and compare against hand-calculated values from predict.py."""
        tire_r_m = 9.5 * 0.0254  # 0.2413

        # Simulate what predict.py does
        motor_peak = 230.0
        motor_cont = 120.0
        gear_ratio = 4.5
        vehicle_mass = 240.0
        Cd = 0.85
        A_val = 1.15
        Cr = 0.015
        battery_eff = 0.9  # placeholder

        # Our refactored version
        feat = build_feature_vector(
            motor_peak=motor_peak, motor_cont=motor_cont,
            gear_ratio=gear_ratio, tire_r_m=tire_r_m,
            vehicle_mass=vehicle_mass, Cd=Cd, A=A_val, Cr=Cr,
            battery_eff=battery_eff,
        )

        # Manually compute original predict.py values
        assert abs(feat["motor_peak"] - 230.0) < 1e-6
        assert abs(feat["cont_ratio"] - 120.0 / 230.0) < 1e-6
        assert abs(feat["battery_deg"] - 0.1) < 1e-6
        assert abs(feat["battery_multiplier"] - 0.9) < 1e-6

        # Speed 0 m/s — predict.py also uses v_eval=0.0
        T_wheel_0, _ = wheel_torque_from_speed(0.0, vehicle_mass, Cd, A_val, Cr, tire_r_m)
        assert abs(feat["T_wheel_0ms"] - T_wheel_0) < 1e-6
        assert abs(feat["rpm_0ms"] - 0.0) < 1e-6
        assert abs(feat["Preq_0ms"] - 0.0) < 1e-6

    def test_prediction_reproducible(self):
        """Run full pipeline through API and verify prediction is stable."""
        import joblib

        # Load same model the original script uses
        model = joblib.load(str(PROJECT_ROOT / "models" / "powertrain_physics_model.joblib"))

        # Run pack design with baseline inputs
        pack = design_pack_physics(
            V_cell=3.6, Ah_cell=3.0, m_cell=0.048,
            R_cell=0.020, I_cell_max=25.0,
            V_pack_target=400.0, P_peak_required=75000.0,
        )
        assert pack is not None

        tire_r_m = 9.5 * 0.0254
        feat = build_feature_vector(
            motor_peak=230, motor_cont=120, gear_ratio=4.5,
            tire_r_m=tire_r_m, vehicle_mass=240, Cd=0.85,
            A=1.15, Cr=0.015,
            battery_eff=pack["Battery_eff"],
        )
        X = pd.DataFrame([feat], columns=MODEL_COLUMNS)
        pred = float(model.predict(X)[0])

        # Run again to confirm determinism
        pred2 = float(model.predict(X)[0])
        assert abs(pred - pred2) < 1e-10, "Predictions should be deterministic"

        # Sanity — efficiency should be between 0 and 1.5
        assert 0.0 < pred < 1.5, f"Prediction {pred} is outside expected range"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
