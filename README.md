# EV Powertrain Prediction using XGBoost

A Python-based EV powertrain design and prediction tool that combines **physics-based battery pack sizing** with **machine learning-based powertrain performance prediction**. The project is intended to explore how motor specifications, vehicle parameters, gearing, and battery characteristics influence electric vehicle performance.

## 🚀 Project Overview

Electric vehicle powertrain design involves balancing performance, battery capacity, voltage, current, and mass. This project combines engineering calculations with an XGBoost model to provide an initial framework for evaluating these parameters.

The program accepts motor, vehicle, and battery-cell specifications, estimates a feasible battery pack configuration, and uses a pre-trained machine learning model to predict powertrain performance.

## ✨ Features

- **Battery Pack Design:** Searches candidate battery configurations using physics-based constraints.
- **Powertrain Prediction:** Uses a pre-trained XGBoost model to estimate powertrain performance.
- **Vehicle Parameter Inputs:** Supports motor torque, gear ratio, vehicle mass, tire radius, drag coefficient, frontal area, and rolling resistance.
- **Battery Parameter Inputs:** Accepts cell voltage, capacity, mass, internal resistance, and maximum discharge current.
- **Pack Feasibility Checks:** Considers target pack voltage, peak power demand, cell current limits, and pack mass constraints.
- **Engineering Output:** Reports estimated pack voltage, loaded voltage, battery efficiency estimate, pack mass, cell count, and energy.
- **Performance Feature Engineering:** Calculates torque, motor RPM, and power-related features at selected vehicle speeds.

## 🛠️ Technology Stack

- Python
- XGBoost
- NumPy
- Pandas
- Joblib
- Physics-based engineering calculations

## 📁 Project Structure

```text
XG_BoostPrediction/
├── models/
│   └── powertrain_physics_model.joblib
├── powertrain_physics_model.joblib
├── predict.py
└── README.md
```

The repository contains a prediction script and saved model artifacts. The exact contents of the `models/` directory may vary by version.

## ⚙️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/VaradAAthalye/XG_BoostPrediction.git
cd XG_BoostPrediction
```

### 2. Create a virtual environment (recommended)

```bash
python -m venv .venv
```

Activate it on Windows:

```bash
.venv\Scripts\activate
```

### 3. Install dependencies

```bash
python -m pip install numpy pandas joblib xgboost
```

## ▶️ How to Run

Run the prediction script from the repository's root directory:

```bash
python predict.py
```

The program prompts you to enter three groups of inputs.

### Powertrain and Vehicle Inputs

- Motor peak torque (Nm)
- Motor continuous torque (Nm)
- Motor maximum RPM
- Gear ratio
- Tire radius (inches)
- Vehicle mass (kg)
- Aerodynamic drag coefficient
- Frontal area (m²)
- Rolling resistance coefficient

### Battery Cell Inputs

- Nominal cell voltage (V)
- Cell capacity (Ah)
- Cell mass (kg)
- Internal resistance (Ω)
- Maximum cell discharge current (A)

### Design Inputs

- Target battery pack voltage (V)
- Required peak power (W)

The script searches for a feasible battery configuration and then constructs the feature inputs for the trained powertrain model.

**Important:** Run the script from the repository root so the relative model path can be resolved.

## 🔋 Battery Pack Design

The battery-pack design component uses engineering calculations and a candidate-search procedure rather than machine learning.

It evaluates configurations based on constraints such as:

- Module voltage
- Module mass
- Module energy
- Total pack mass
- Total number of cells
- Required pack voltage
- Cell discharge-current capability

The selected configuration is reported with values including:

| Parameter | Description |
|---|---|
| `S_mod` | Series-connected cells per module |
| `P_mod` | Parallel-connected cells per module |
| `Ns_modules` | Number of modules in series |
| `Np` | Number of parallel module strings |
| `V_pack` | Estimated nominal pack voltage |
| `V_load` | Estimated loaded pack voltage |
| `Battery_eff` | Modelled battery efficiency estimate |
| `Mass_pack` | Estimated pack mass |
| `Cells_total` | Total cell count |
| `Energy_Wh` | Estimated pack energy in watt-hours |

These outputs are estimates based on the implementation's assumptions and constraints, not a substitute for detailed battery-pack engineering validation.

## 🤖 XGBoost Powertrain Model

The project uses a saved model loaded through Joblib. Its input features include motor specifications, gearing, battery-related parameters, vehicle properties, and derived operating-point features.

The feature set includes calculations at selected speeds of **0 m/s, 5 m/s, and 20 m/s**, including:

- Wheel torque
- Motor torque
- Motor rotational speed (RPM)
- Required power

The model uses these features to generate a powertrain performance prediction.

## 📊 Model Evaluation

For meaningful model evaluation, use a separate test dataset and report appropriate metrics for the prediction target, such as:

- Mean Absolute Error (MAE)
- Mean Squared Error (MSE)
- R² Score

Evaluation results should only be added after they have been measured and verified. A strong score on synthetic or physics-generated data does not, by itself, demonstrate accuracy on a real vehicle.

## ⚠️ Limitations

- The quality of predictions depends on the training data and the assumptions used to generate it.
- The battery-pack optimizer uses simplified electrical and mechanical assumptions.
- The script includes modelling assumptions that may not capture real drivetrain losses, motor/inverter efficiency maps, battery thermal behaviour, or transient operation.
- Real-world accuracy requires validation against measured vehicle data, dynamometer testing, and battery measurements.
- The output should be treated as a preliminary engineering estimate, not a certified design or safety recommendation.

## 🔮 Future Improvements

- Add real motor and inverter efficiency maps.
- Validate predictions using Formula Student or other EV test data.
- Improve battery voltage-sag and current-limit modelling.
- Integrate battery thermal modelling and degradation estimation.
- Add visualizations for torque, power, speed, and efficiency.
- Develop an interactive interface for entering vehicle specifications and comparing designs.
- Store design configurations and prediction results for comparison.

## 🎯 Applications

Potential applications include:

- Formula Student and Formula SAE EV development
- Preliminary electric powertrain studies
- Battery-pack configuration exploration
- Educational machine learning and engineering projects
- Comparing design alternatives during early-stage development

## 👨‍💻 Author

**Varad Athalye**

GitHub: [@VaradAAthalye](https://github.com/VaradAAthalye)

## 📄 Disclaimer

This project is intended for educational and preliminary engineering analysis. All predictions and design outputs should be independently verified before being used in a physical vehicle. Battery packs and high-voltage EV systems require appropriate engineering review and safety validation.
