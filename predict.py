# predict.py
"""
EV Powertrain Intelligence Platform — Interactive CLI Script

Physics-based battery pack designer + powertrain XGBoost predictor.
This script uses the reusable calculations from backend.physics_engine.
"""

import sys
from pathlib import Path
import joblib
import pandas as pd

# Resolve paths relative to this file
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.physics_engine import (
    MODEL_COLUMNS,
    DRIVETRAIN_EFF,
    G,
    RHO_AIR_DEFAULT,
    build_feature_vector,
    compute_pack_explanation,
    design_pack_physics,
    motor_torque_from_wheel,
    power_from_torque_and_speed,
    rpm_from_speed,
    wheel_torque_from_speed,
)


def run_interactive_cli():
    # Resolve model path relative to this script
    model_path = PROJECT_ROOT / "models" / "powertrain_physics_model.joblib"
    if not model_path.exists():
        model_path = PROJECT_ROOT / "powertrain_physics_model.joblib"

    try:
        powertrain_model = joblib.load(str(model_path))
    except Exception as e:
        print(f"ERROR: Could not load powertrain model from {model_path}: {e}")
        sys.exit(1)

    def _num(prompt):
        try:
            return float(input(prompt))
        except (ValueError, EOFError):
            print("Invalid input.")
            sys.exit(1)

    print("\n=== Enter POWERTRAIN Inputs ===")
    motor_peak = _num("Motor peak torque (Nm): ")
    motor_cont = _num("Motor continuous torque (Nm): ")
    motor_max_rpm = _num("Motor max RPM: ")
    gear_ratio = _num("Gear ratio: ")
    tire_r_in = _num("Tire radius (inches): ")
    vehicle_mass = _num("Vehicle mass (kg): ")
    Cd = _num("Drag coefficient Cd: ")
    A = _num("Frontal area (m^2): ")
    Cr = _num("Rolling resistance Cr: ")

    tire_r_m = tire_r_in * 0.0254

    print("\n=== Enter BATTERY CELL Inputs ===")
    V_cell = _num("Cell nominal voltage (V): ")
    Ah_cell = _num("Cell capacity (Ah): ")
    m_cell = _num("Cell mass (kg): ")
    R_cell = _num("Internal resistance (ohm): ")
    I_cell_max = _num("Max discharge current per cell (A): ")

    print("\n=== Enter DESIGN Inputs ===")
    V_pack_target = _num("Target pack voltage: ")
    P_peak_required = _num("Required peak power (<=80000): ")

    # Run physics pack design
    pack = design_pack_physics(
        V_cell=V_cell,
        Ah_cell=Ah_cell,
        m_cell=m_cell,
        R_cell=R_cell,
        I_cell_max=I_cell_max,
        V_pack_target=V_pack_target,
        P_peak_required=P_peak_required,
    )

    if pack is None:
        print("No feasible pack found. Adjust parameters.")
        sys.exit(1)

    print("\n===== BATTERY PACK PREDICTION =====")
    for k, v in pack.items():
        print(f"{k}: {v}")

    # Pack explanation
    explanation_data = compute_pack_explanation(
        pack=pack,
        V_cell=V_cell,
        Ah_cell=Ah_cell,
        I_cell_max=I_cell_max,
        V_pack_target=V_pack_target,
        P_peak_required=P_peak_required,
    )

    print("\n===== EXPLANATION OF PACK DESIGN =====")
    for k, v in explanation_data["explanation"].items():
        print(f"  {k}: {v}")

    # Build feature vector
    feat = build_feature_vector(
        motor_peak=motor_peak,
        motor_cont=motor_cont,
        gear_ratio=gear_ratio,
        tire_r_m=tire_r_m,
        vehicle_mass=vehicle_mass,
        Cd=Cd,
        A=A,
        Cr=Cr,
        battery_eff=pack["Battery_eff"],
    )

    row = {c: feat.get(c, 0.0) for c in MODEL_COLUMNS}
    X = pd.DataFrame([row], columns=MODEL_COLUMNS)

    # ML Prediction
    pred = float(powertrain_model.predict(X)[0])

    print("\n=== FINAL RESULT ===")
    print(f"Predicted Max Efficiency: {pred*100:.2f}%")


if __name__ == "__main__":
    run_interactive_cli()
