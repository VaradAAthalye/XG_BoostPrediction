import joblib
import numpy as np

# --------------------------
# HELPER: Compute extra powertrain features
# --------------------------
def compute_pt_features(motor_peak, motor_cont, gear_ratio, tire_r, Cd, A, Cr, rho, vehicle_mass):
    # battery factors (unknown → assume fresh battery)
    battery_deg = 0.0
    cont_ratio = motor_cont / motor_peak
    battery_multiplier = 1.0

    speeds = [0, 5, 20]  # m/s
    T_w_list = []
    T_m_list = []
    rpm_list = []
    P_req_list = []

    for v in speeds:
        F_roll = vehicle_mass * 9.81 * Cr
        F_aero = 0.5 * rho * Cd * A * (v ** 2)
        F_accel = vehicle_mass * 4.0 if v < 5 else 0.0
        F_total = F_roll + F_aero + F_accel

        T_wheel = F_total * tire_r
        T_motor = T_wheel / max(1e-6, gear_ratio * 0.90)  # drivetrain eff = 0.9
        omega_wheel = v / tire_r
        omega_motor = omega_wheel * gear_ratio
        rpm = omega_motor * 60 / (2 * np.pi)

        P_req = T_motor * omega_motor

        T_w_list.append(T_wheel)
        T_m_list.append(T_motor)
        rpm_list.append(rpm)
        P_req_list.append(P_req)

    # Return VECTOR for ML
    pt_vec = np.array([[
        motor_peak, motor_cont, gear_ratio,
        battery_deg,
        tire_r, vehicle_mass, Cd, A, Cr, rho,
        cont_ratio, battery_multiplier,
        T_w_list[0], T_m_list[0], rpm_list[0], P_req_list[0],
        T_w_list[1], T_m_list[1], rpm_list[1], P_req_list[1],
        T_w_list[2], T_m_list[2], rpm_list[2], P_req_list[2]
    ]])

    return pt_vec


# --------------------------
# MAIN PREDICTION SCRIPT
# --------------------------
print("\n=== Enter POWERTRAIN Inputs ===")
motor_peak = float(input("Motor peak torque (Nm): "))
motor_cont = float(input("Motor continuous torque (Nm): "))
motor_max_rpm = float(input("Motor max RPM: "))
gear_ratio = float(input("Gear ratio: "))
tire_inch = float(input("Tire radius (inches): "))
vehicle_mass = float(input("Vehicle mass (kg): "))
Cd = float(input("Drag coefficient Cd: "))
A = float(input("Frontal area (m^2): "))
Cr = float(input("Rolling resistance Cr: "))

print("\n=== Enter BATTERY CELL Inputs ===")
V_cell = float(input("Cell nominal voltage (V): "))
Ah_cell = float(input("Cell capacity (Ah): "))
m_cell = float(input("Cell mass (kg): "))
R_cell = float(input("Internal resistance (ohm): "))
I_cell_max = float(input("Max discharge current (A): "))

print("\n=== Enter DESIGN Inputs ===")
V_pack_target = float(input("Target pack voltage: "))
P_peak_required = float(input("Required peak power (<=80000): "))

# Convert tire size
tire_r = tire_inch * 0.0254

# --------------------------
# LOAD MODELS
# --------------------------
battery_model = joblib.load("models/battery_pack_model.joblib")
powertrain_model = joblib.load("models/powertrain_physics_model.joblib")

# --------------------------
# BATTERY PACK PREDICTION
# --------------------------
X_batt = np.array([[
    V_cell, Ah_cell, m_cell, R_cell,
    I_cell_max, V_pack_target, P_peak_required
]])

S_mod  = int(round(battery_model["S_mod"].predict(X_batt)[0]))
P_mod  = int(round(battery_model["P_mod"].predict(X_batt)[0]))
Ns     = int(round(battery_model["Ns"].predict(X_batt)[0]))
Np     = int(round(battery_model["Np"].predict(X_batt)[0]))
V_pack_raw = float(battery_model["V_pack"].predict(X_batt)[0])

# Force pack voltage close to target
V_pack = max(0.8*V_pack_target, min(V_pack_raw, 1.2*V_pack_target))

mass_pack = float(battery_model["mass_pack"].predict(X_batt)[0])
bat_eff = float(battery_model["battery_eff"].predict(X_batt)[0])

print("\n===== BATTERY PACK PREDICTION =====")
print(f"S_mod = {S_mod}")
print(f"P_mod = {P_mod}")
print(f"Ns    = {Ns}")
print(f"Np    = {Np}")
print(f"V_pack = {V_pack:.2f} V")
print(f"Mass  = {mass_pack:.2f} kg")
print(f"Battery_eff = {bat_eff:.4f}")

# --------------------------
# POWERTRAIN EFFICIENCY PREDICTION
# --------------------------
print("\n==== Predicting Powertrain Efficiency ====")

pt_features = compute_pt_features(
    motor_peak, motor_cont, gear_ratio,
    tire_r, Cd, A, Cr, 1.225, vehicle_mass
)

pred_eff_pt = float(powertrain_model.predict(pt_features)[0])

print("\n=== FINAL RESULT ===")
print(f"Predicted Max Efficiency: {pred_eff_pt * 100:.2f}%")
