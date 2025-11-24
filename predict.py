# predict.py
"""
Predict script — physics battery pack designer + powertrain ML predictor.

This version is fully cleaned, corrected, and aligned with:
 - physics-based battery pack keys
 - MODEL_COLUMNS from your trained model
 - Proper explanation block
 - Proper naming consistency
"""

import sys
import math
import joblib
import numpy as np
import pandas as pd

# ---------------------------
# Settings / constants
# ---------------------------
DRIVETRAIN_EFF = 1.0
G = 9.81
RHO_AIR_DEFAULT = 1.225

MODEL_COLUMNS = [
    'motor_peak', 'motor_cont', 'gear_ratio', 'battery_deg', 'tire_radius',
    'vehicle_mass', 'Cd', 'A', 'Cr', 'rho', 'cont_ratio',
    'battery_multiplier',
    'T_wheel_0ms', 'T_motor_0ms', 'rpm_0ms', 'Preq_0ms',
    'T_wheel_5ms', 'T_motor_5ms', 'rpm_5ms', 'Preq_5ms',
    'T_wheel_20ms', 'T_motor_20ms', 'rpm_20ms', 'Preq_20ms'
]

# ---------------------------
# Helper physics functions
# ---------------------------

def wheel_torque_from_speed(v, mass, Cd, A, Cr, tire_r, a_launch=4.0, v_launch_thresh=5.0,
                            rho=RHO_AIR_DEFAULT, min_frac=0.15, wheel_peak_torque=550.0):

    F_roll = mass * G * Cr
    F_aero = 0.5 * rho * Cd * A * (v ** 2)
    F_grade = 0.0
    a_req = a_launch if v < v_launch_thresh else 0.0
    F_accel = mass * a_req

    F_req = F_roll + F_aero + F_grade + F_accel
    T_wheel = F_req * tire_r

    min_torque = wheel_peak_torque * min_frac
    if T_wheel < min_torque:
        T_wheel = min_torque

    return T_wheel, F_req


def rpm_from_speed(v, tire_r, gear_ratio):
    if tire_r <= 0:
        return 0.0
    omega_wheel = v / tire_r
    omega_motor = omega_wheel * gear_ratio
    return omega_motor * 60.0 / (2 * math.pi)


def motor_torque_from_wheel(T_wheel, gear_ratio, drivetrain_eff=DRIVETRAIN_EFF):
    denom = gear_ratio * drivetrain_eff
    if denom == 0:
        return float("inf")
    return T_wheel / denom


def power_from_torque_and_speed(T, v, tire_r):
    if tire_r <= 0:
        return 0.0
    omega_wheel = v / tire_r
    return float(T * omega_wheel)

# ---------------------------
# Physics battery pack designer (corrected)
# ---------------------------

def design_pack_physics(V_cell, Ah_cell, m_cell, R_cell, I_cell_max,
                         V_pack_target, P_peak_required):

    MAX_MOD_VOLT = 120
    MAX_MOD_MASS = 12
    MAX_MOD_ENERGY_J = 6e6
    MAX_PACK_MASS = 60
    MAX_CELLS_TOTAL = 2000
    MAX_NS = 30
    MAX_NP = 6

    best_pack = None

    for S in range(2, 30):  # series per module
        V_mod = S * V_cell
        if V_mod > MAX_MOD_VOLT:
            continue

        for P in range(1, 20):  # parallel per module
            cells_mod = S * P
            m_mod = cells_mod * m_cell
            if m_mod > MAX_MOD_MASS:
                continue

            E_mod_Wh = S * V_cell * (P * Ah_cell)
            E_mod_J = E_mod_Wh * 3600
            if E_mod_J > MAX_MOD_ENERGY_J:
                continue

            for Ns in range(2, MAX_NS):
                V_pack = Ns * V_mod
                if not (0.9 * V_pack_target <= V_pack <= 1.1 * V_pack_target):
                    continue

                I_pack_req = P_peak_required / V_pack
                I_cell_at_peak = I_pack_req / P
                if I_cell_at_peak > I_cell_max:
                    continue

                for Np in range(1, MAX_NP + 1):
                    total_cells = Ns * Np * cells_mod

                    if total_cells > MAX_CELLS_TOTAL:
                        continue

                    mass_pack = total_cells * m_cell
                    if mass_pack > MAX_PACK_MASS:
                        continue

                    R_pack = (R_cell * S * Ns) / (P * Np)
                    V_load = V_pack - I_pack_req * R_pack
                    eff = max(0.5, min(1.0, V_load / V_pack))

                    pack = {
                        "S_mod": S,
                        "P_mod": P,
                        "Ns_modules": Ns,
                        "Np": Np,
                        "V_pack": round(V_pack, 2),
                        "V_load": round(V_load, 2),
                        "Battery_eff": round(eff, 4),
                        "Mass_pack": round(mass_pack, 2),
                        "Cells_total": total_cells,
                        "Energy_Wh": round(total_cells * Ah_cell * V_cell, 2)
                    }

                    if (best_pack is None) or (eff > best_pack["Battery_eff"]) or \
                       (eff == best_pack["Battery_eff"] and mass_pack < best_pack["Mass_pack"]):
                        best_pack = pack

    return best_pack

# ---------------------------
# Load powertrain ML model
# ---------------------------
try:
    powertrain_model = joblib.load("models/powertrain_physics_model.joblib")
except Exception as e:
    print("ERROR: Could not load powertrain model.", e)
    sys.exit(1)

# ---------------------------
# Input handling
# ---------------------------
def _num(prompt):
    try:
        return float(input(prompt))
    except:
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

# ---------------------------
# Battery pack design
# ---------------------------
pack = design_pack_physics(V_cell, Ah_cell, m_cell, R_cell,
                           I_cell_max, V_pack_target, P_peak_required)

if pack is None:
    print("No feasible pack found. Adjust parameters.")
    sys.exit(1)

print("\n===== BATTERY PACK PREDICTION =====")
for k, v in pack.items():
    print(f"{k}: {v}")

# ---------------------------
# Explanation block
# ---------------------------
S = pack["S_mod"]
P = pack["P_mod"]
Ns = pack["Ns_modules"]
Np = pack["Np"]
total_cells = pack["Cells_total"]

E_mod_Wh = S * V_cell * (P * Ah_cell)
E_mod_J = E_mod_Wh * 3600
I_module_max = P * I_cell_max
I_pack_max = Np * I_module_max

print("\n===== EXPLANATION OF BATTERY PACK =====")
print(f"Each module = {S} series × {P} parallel = {S*P} cells")
print(f"Module Voltage = {S*V_cell:.2f} V")
print(f"Module Capacity = {P*Ah_cell:.2f} Ah")
print(f"Module Energy = {E_mod_Wh:.2f} Wh ({E_mod_J/1e6:.3f} MJ)")
print(f"Module Max Current = {I_module_max:.2f} A")
print(f"Pack contains {Ns} modules in series × {Np} in parallel")
print(f"Total Cells = {total_cells}")
print(f"Pack Energy = {pack['Energy_Wh']:.1f} Wh")
print(f"Max Pack Current = {I_pack_max:.2f} A")
print(f"Target voltage {V_pack_target} V → Achieved {pack['V_pack']} V")

# ---------------------------
# Build ML feature vector
# ---------------------------
speeds = [0.0, 5.0, 20.0]

feat = {
    "motor_peak": motor_peak,
    "motor_cont": motor_cont,
    "gear_ratio": gear_ratio,
    "battery_deg": 1 - pack["Battery_eff"],
    "tire_radius": tire_r_m,
    "vehicle_mass": vehicle_mass,
    "Cd": Cd,
    "A": A,
    "Cr": Cr,
    "rho": RHO_AIR_DEFAULT,
    "cont_ratio": motor_cont / motor_peak,
    "battery_multiplier": pack["Battery_eff"]
}

# compute speed-dependent features
for v in speeds:
    v_eval = 0.0 if v == 0 else v
    T_wheel, _ = wheel_torque_from_speed(v_eval, vehicle_mass, Cd, A, Cr, tire_r_m)
    T_motor = motor_torque_from_wheel(T_wheel, gear_ratio)
    rpm = rpm_from_speed(v_eval, tire_r_m, gear_ratio)
    Preq = power_from_torque_and_speed(T_wheel, v_eval, tire_r_m)

    suf = "_0ms" if v==0 else "_5ms" if v==5 else "_20ms"
    feat[f"T_wheel{suf}"] = T_wheel
    feat[f"T_motor{suf}"] = T_motor
    feat[f"rpm{suf}"] = rpm
    feat[f"Preq{suf}"] = Preq

# build DataFrame
row = {c: feat.get(c, 0.0) for c in MODEL_COLUMNS}
X = pd.DataFrame([row], columns=MODEL_COLUMNS)

# ---------------------------
# ML Prediction
# ---------------------------
pred = float(powertrain_model.predict(X)[0])

print("\n=== FINAL RESULT ===")
print(f"Predicted Max Efficiency: {pred*100:.2f}%")
