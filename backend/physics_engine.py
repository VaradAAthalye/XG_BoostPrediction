"""
Powertrain physics engine — extracted from predict.py.

This module contains the reusable physics calculations for:
 - Wheel torque from vehicle speed
 - Motor RPM from vehicle speed
 - Motor torque from wheel torque
 - Power from torque and speed
 - Battery pack design (brute-force candidate search)
 - ML feature vector construction

All functions are pure: no interactive I/O, no model loading,
no global side effects.
"""

import math
from typing import Dict, List, Optional, Tuple

# ---------------------
# Constants
# ---------------------
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

BATTERY_MODEL_FEATURES = [
    'V_cell', 'Ah_cell', 'm_cell', 'R_cell', 'I_cell_max',
    'V_pack_target', 'P_peak_required'
]

# ---------------------
# Physics helpers
# ---------------------

def wheel_torque_from_speed(
    v: float,
    mass: float,
    Cd: float,
    A: float,
    Cr: float,
    tire_r: float,
    a_launch: float = 4.0,
    v_launch_thresh: float = 5.0,
    rho: float = RHO_AIR_DEFAULT,
    min_frac: float = 0.15,
    wheel_peak_torque: float = 550.0,
) -> Tuple[float, float]:
    """Calculate wheel torque and total force at a given speed."""
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


def rpm_from_speed(v: float, tire_r: float, gear_ratio: float) -> float:
    """Calculate motor RPM from vehicle speed, tire radius, and gear ratio."""
    if tire_r <= 0:
        return 0.0
    omega_wheel = v / tire_r
    omega_motor = omega_wheel * gear_ratio
    return omega_motor * 60.0 / (2 * math.pi)


def motor_torque_from_wheel(
    T_wheel: float,
    gear_ratio: float,
    drivetrain_eff: float = DRIVETRAIN_EFF,
) -> float:
    """Calculate motor torque from wheel torque, gear ratio, and drivetrain efficiency."""
    denom = gear_ratio * drivetrain_eff
    if denom == 0:
        return float("inf")
    return T_wheel / denom


def power_from_torque_and_speed(T: float, v: float, tire_r: float) -> float:
    """Calculate power (W) from wheel torque and vehicle speed."""
    if tire_r <= 0:
        return 0.0
    omega_wheel = v / tire_r
    return float(T * omega_wheel)


# ---------------------
# Battery pack designer
# ---------------------

def design_pack_physics(
    V_cell: float,
    Ah_cell: float,
    m_cell: float,
    R_cell: float,
    I_cell_max: float,
    V_pack_target: float,
    P_peak_required: float,
) -> Optional[Dict]:
    """
    Search for the best feasible battery pack configuration
    using physics-based constraints.

    Returns a dict with pack parameters or None if no feasible config found.
    """
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
                        "Energy_Wh": round(total_cells * Ah_cell * V_cell, 2),
                    }

                    if (best_pack is None) or (eff > best_pack["Battery_eff"]) or \
                       (eff == best_pack["Battery_eff"] and mass_pack < best_pack["Mass_pack"]):
                        best_pack = pack

    return best_pack


# ---------------------
# Explanation / diagnostics
# ---------------------

def compute_pack_explanation(
    pack: Dict,
    V_cell: float,
    Ah_cell: float,
    I_cell_max: float,
    V_pack_target: float,
    P_peak_required: float,
) -> Dict:
    """Compute detailed pack explanation and diagnostics from a pack configuration."""
    S = pack["S_mod"]
    P = pack["P_mod"]
    Ns = pack["Ns_modules"]
    Np = pack["Np"]
    total_cells = pack["Cells_total"]

    E_mod_Wh = S * V_cell * (P * Ah_cell)
    E_mod_J = E_mod_Wh * 3600
    I_module_max = P * I_cell_max
    I_pack_max = Np * I_module_max
    module_voltage = round(S * V_cell, 2)
    module_capacity = round(P * Ah_cell, 2)

    V_pack = pack["V_pack"]
    V_load = pack["V_load"]
    voltage_drop = round(V_pack - V_load, 2)

    I_pack_req = P_peak_required / V_pack if V_pack > 0 else 0
    I_cell_at_peak = I_pack_req / (P * Np) if (P * Np) > 0 else 0

    R_pack = (0.020 * S * Ns) / (P * Np)  # approximate using typical R_cell
    thermal_loss = I_pack_req ** 2 * R_pack if I_pack_req > 0 else 0

    explanation = {
        "S": S,
        "P": P,
        "Ns": Ns,
        "Np": Np,
        "cells_per_module": S * P,
        "total_cells": total_cells,
        "module_voltage_V": module_voltage,
        "module_capacity_Ah": module_capacity,
        "module_energy_Wh": round(E_mod_Wh, 2),
        "module_energy_MJ": round(E_mod_J / 1e6, 3),
        "module_max_current_A": round(I_module_max, 2),
        "target_voltage_V": V_pack_target,
        "achieved_voltage_V": V_pack,
        "voltage_drop_V": voltage_drop,
    }

    diagnostics = {
        "i_pack_peak_A": round(I_pack_req, 2),
        "i_cell_peak_A": round(I_cell_at_peak, 2),
        "i_cell_utilization_percent": round(
            (I_cell_at_peak / I_cell_max * 100) if I_cell_max > 0 else 0, 1
        ),
        "i_pack_max_continuous_A": round(I_pack_max, 2),
        "voltage_sag_percent": round(
            (voltage_drop / V_pack * 100) if V_pack > 0 else 0, 2
        ),
        "thermal_loss_at_peak_kW": round(thermal_loss / 1000, 2),
    }

    return {"explanation": explanation, "diagnostics": diagnostics}


# ---------------------
# Feature engineering
# ---------------------

def build_feature_vector(
    motor_peak: float,
    motor_cont: float,
    gear_ratio: float,
    tire_r_m: float,
    vehicle_mass: float,
    Cd: float,
    A: float,
    Cr: float,
    battery_eff: float,
) -> Dict[str, float]:
    """
    Build the 24-feature dict expected by the powertrain XGBoost model.
    Exactly replicates the logic from predict.py.
    """
    feat: Dict[str, float] = {
        "motor_peak": motor_peak,
        "motor_cont": motor_cont,
        "gear_ratio": gear_ratio,
        "battery_deg": 1 - battery_eff,
        "tire_radius": tire_r_m,
        "vehicle_mass": vehicle_mass,
        "Cd": Cd,
        "A": A,
        "Cr": Cr,
        "rho": RHO_AIR_DEFAULT,
        "cont_ratio": motor_cont / motor_peak if motor_peak != 0 else 0,
        "battery_multiplier": battery_eff,
    }

    speeds = [0.0, 5.0, 20.0]
    for v in speeds:
        v_eval = 0.0 if v == 0 else v
        T_wheel, _ = wheel_torque_from_speed(
            v_eval, vehicle_mass, Cd, A, Cr, tire_r_m
        )
        T_motor = motor_torque_from_wheel(T_wheel, gear_ratio)
        rpm = rpm_from_speed(v_eval, tire_r_m, gear_ratio)
        Preq = power_from_torque_and_speed(T_wheel, v_eval, tire_r_m)

        suf = "_0ms" if v == 0 else "_5ms" if v == 5 else "_20ms"
        feat[f"T_wheel{suf}"] = T_wheel
        feat[f"T_motor{suf}"] = T_motor
        feat[f"rpm{suf}"] = rpm
        feat[f"Preq{suf}"] = Preq

    # Ensure we have exactly the MODEL_COLUMNS in correct order
    return {c: feat.get(c, 0.0) for c in MODEL_COLUMNS}


def compute_speed_telemetry(
    vehicle_mass: float,
    Cd: float,
    A: float,
    Cr: float,
    tire_r_m: float,
    gear_ratio: float,
) -> List[Dict]:
    """Compute telemetry data at the three benchmark speeds (0, 5, 20 m/s)."""
    speeds = [
        (0.0, "Launch / Standstill"),
        (5.0, "Corner Exit (5 m/s)"),
        (20.0, "High Speed Straight (20 m/s)"),
    ]
    telemetry = []
    for v, condition in speeds:
        T_wheel, _ = wheel_torque_from_speed(v, vehicle_mass, Cd, A, Cr, tire_r_m)
        T_motor = motor_torque_from_wheel(T_wheel, gear_ratio)
        rpm = rpm_from_speed(v, tire_r_m, gear_ratio)
        Preq = power_from_torque_and_speed(T_wheel, v, tire_r_m)

        telemetry.append({
            "speed_ms": v,
            "speed_kmh": round(v * 3.6, 1),
            "condition": condition,
            "wheel_torque_Nm": round(T_wheel, 2),
            "motor_torque_Nm": round(T_motor, 2),
            "motor_rpm": round(rpm, 1),
            "power_req_kW": round(Preq / 1000, 2),
        })

    return telemetry


def compute_velocity_curve(
    vehicle_mass: float,
    Cd: float,
    A: float,
    Cr: float,
    tire_r_m: float,
    gear_ratio: float,
    max_speed_kmh: float = 160.0,
    step_kmh: float = 5.0,
) -> List[Dict]:
    """
    Generate physics-derived torque and power curves over a velocity range.
    These are calculated values (not ML predictions).
    """
    curve = []
    v_kmh = 0.0
    while v_kmh <= max_speed_kmh:
        v_ms = v_kmh / 3.6
        T_wheel, F_req = wheel_torque_from_speed(
            v_ms, vehicle_mass, Cd, A, Cr, tire_r_m,
            a_launch=4.0, v_launch_thresh=5.0,
        )
        T_motor = motor_torque_from_wheel(T_wheel, gear_ratio)
        rpm = rpm_from_speed(v_ms, tire_r_m, gear_ratio)
        Preq = power_from_torque_and_speed(T_wheel, v_ms, tire_r_m)

        curve.append({
            "speed_kmh": round(v_kmh, 1),
            "speed_ms": round(v_ms, 2),
            "wheel_torque_Nm": round(T_wheel, 2),
            "motor_torque_Nm": round(T_motor, 2),
            "motor_rpm": round(rpm, 1),
            "power_kW": round(Preq / 1000, 2),
            "force_N": round(F_req, 2),
        })
        v_kmh += step_kmh

    return curve
