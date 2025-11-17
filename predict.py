import joblib
import numpy as np
import pandas as pd
import math

# -----------------------------
# Physics helper functions
# -----------------------------
def wheel_force_components(v, m, Cr, rho, Cd, A, a_req=0.0, theta=0.0):
    g = 9.81
    F_roll = m * g * Cr
    F_aero = 0.5 * rho * Cd * A * v**2
    F_grade = m * g * math.sin(theta)
    F_accel = m * a_req
    return F_roll, F_aero, F_grade, F_accel, (F_roll + F_aero + F_grade + F_accel)

def motor_rpm_from_speed(v, gear, tire_r):
    omega_motor = (v / tire_r) * gear
    rpm = omega_motor * 60.0 / (2 * math.pi)
    return rpm

def power_required_aero_roll(v, m, Cr, rho, Cd, A):
    g = 9.81
    F_roll = m * g * Cr
    F_aero = 0.5 * rho * Cd * A * v**2
    return (F_roll + F_aero) * v

def battery_efficiency_from_degradation(deg):
    return float(np.clip(1.0 - 0.4 * deg, 0.5, 1.0))

DEFAULT_DRIVETRAIN_EFF = 0.90
DEFAULT_MOTOR_MAX_RPM = 15000
VEHICLE_SPEEDS = np.linspace(0.1, 50.0, 500)

# -----------------------------
# Motor efficiency model
# -----------------------------
def motor_efficiency_model(torque, omega, motor_peak, motor_max_rpm=DEFAULT_MOTOR_MAX_RPM):
    rpm = omega * 60.0 / (2 * np.pi)
    nt = np.clip(np.abs(torque) / max(1e-6, motor_peak), 0.0, 1.0)
    ns = np.clip(rpm / motor_max_rpm, 0.0, 1.0)
    eta = 0.6 + 0.35 * np.exp(-((nt - 0.45)**2) / 0.08) * np.exp(-((ns - 0.35)**2) / 0.18)
    if nt > 0.9: eta *= 0.85
    if ns > 0.95: eta *= 0.90
    return float(np.clip(eta, 0.05, 0.98))

# -----------------------------
# Full physics simulator
# -----------------------------
def compute_max_efficiency_for_sample(m_peak, m_cont, gear, batt_deg,
                                      tire_r, mass, Cd, A, Cr, rho):

    effs, speeds, torques, rpms, feasible_flags = [], [], [], [], []

    for v in VEHICLE_SPEEDS:
        F_roll, F_aero, F_grade, F_accel, F_req = wheel_force_components(
            v, mass, Cr, rho, Cd, A
        )

        T_wheel = F_req * tire_r
        T_motor = T_wheel / (gear * DEFAULT_DRIVETRAIN_EFF)

        feasible = (T_motor <= m_peak) and (T_motor <= m_cont)
        omega_motor = (v / tire_r) * gear
        rpm_motor = omega_motor * 60 / (2 * math.pi)

        eff_motor = motor_efficiency_model(T_motor, omega_motor, m_peak)
        eff_batt = battery_efficiency_from_degradation(batt_deg)
        eff_total = float(np.clip(eff_motor * DEFAULT_DRIVETRAIN_EFF * eff_batt, 0, 1))

        effs.append(eff_total)
        speeds.append(v)
        torques.append(T_motor)
        rpms.append(rpm_motor)
        feasible_flags.append(feasible)

    feasible_idx = [i for i, f in enumerate(feasible_flags) if f]

    if len(feasible_idx) == 0:
        return 0, None, None, None, False

    best_local = int(np.argmax([effs[i] for i in feasible_idx]))
    i = feasible_idx[best_local]

    return (
        float(effs[i]),
        float(speeds[i] * 3.6),
        float(torques[i]),
        float(rpms[i]),
        True
    )

# -----------------------------
# Load the trained model
# -----------------------------
model = joblib.load("powertrain_physics_model.joblib")

# -----------------------------
# Build ML feature vector
# -----------------------------
feature_cols = [
    'motor_peak','motor_cont','gear_ratio','battery_deg','tire_radius',
    'vehicle_mass','Cd','A','Cr','rho','cont_ratio','battery_multiplier',
    'T_wheel_0ms','T_motor_0ms','rpm_0ms','Preq_0ms',
    'T_wheel_5ms','T_motor_5ms','rpm_5ms','Preq_5ms',
    'T_wheel_20ms','T_motor_20ms','rpm_20ms','Preq_20ms'
]

def build_feat(m_peak, m_cont, gear, batt_deg, tire_r, mass, Cd, A, Cr, rho):
    cont_ratio = m_cont / max(1e-6, m_peak)
    batt_mult = battery_efficiency_from_degradation(batt_deg)

    speeds = [0.1, 5.0, 20.0]
    phys = {}

    for v in speeds:
        F_roll, F_aero, F_grade, F_accel, F_req = wheel_force_components(v, mass, Cr, rho, Cd, A)
        T_wheel = F_req * tire_r
        T_motor = T_wheel / (gear * DEFAULT_DRIVETRAIN_EFF)
        rpm_m = motor_rpm_from_speed(v, gear, tire_r)
        P_req = power_required_aero_roll(v, mass, Cr, rho, Cd, A)

        key = f"{int(v)}ms"
        phys[f"T_wheel_{key}"] = T_wheel
        phys[f"T_motor_{key}"] = T_motor
        phys[f"rpm_{key}"] = rpm_m
        phys[f"Preq_{key}"] = P_req

    return {
        'motor_peak': m_peak,
        'motor_cont': m_cont,
        'gear_ratio': gear,
        'battery_deg': batt_deg,
        'tire_radius': tire_r,
        'vehicle_mass': mass,
        'Cd': Cd,
        'A': A,
        'Cr': Cr,
        'rho': rho,
        'cont_ratio': cont_ratio,
        'battery_multiplier': batt_mult,
        **phys
    }

# -----------------------------
# User input
# -----------------------------
print("\n=== POWERTRAIN EFFICIENCY PREDICTOR ===\n")

m_peak = float(input("Motor peak torque (Nm): "))
m_cont = float(input("Motor continuous torque (Nm): "))
gear = float(input("Gear ratio: "))
SOC = float(input("Battery SOC %: "))
batt_deg = (100 - SOC) / 100.0
tire_in = float(input("Tire radius (inches): "))
tire_r = tire_in * 0.0254
mass = float(input("Vehicle mass (kg): "))
Cd = float(input("Drag coeff Cd: "))
A = float(input("Frontal area A (m^2): "))
Cr = float(input("Rolling resistance Cr: "))
rho = 1.225

feat = build_feat(m_peak, m_cont, gear, batt_deg, tire_r, mass, Cd, A, Cr, rho)
X = pd.DataFrame([feat])[feature_cols]

eff_pred = float(model.predict(X)[0])

# Run physics ground truth
phys_eff, phys_spd, phys_tq, phys_rpm, feas = compute_max_efficiency_for_sample(
    m_peak, m_cont, gear, batt_deg, tire_r, mass, Cd, A, Cr, rho
)

print("\n--- RESULTS ---")
print(f"ML Predicted Max Efficiency    : {eff_pred*100:.2f}%")

if feas:
    print(f"Physics Max Efficiency         : {phys_eff*100:.2f}%")
    print(f"Speed at Max Efficiency        : {phys_spd:.2f} km/h")
    print(f"Motor Torque @ Max Eff         : {phys_tq:.2f} Nm")
    print(f"Motor RPM @ Max Eff            : {phys_rpm:.2f} rpm")
else:
    print("Physics calculation: NOT FEASIBLE configuration")

print("--------------------------\n")
