import joblib
m = joblib.load('models/battery_pack_model.joblib')
print('Keys:', list(m.keys()))
for k, v in m.items():
    print(f'\n--- {k} ---')
    print(f'  Type: {type(v)}')
    if hasattr(v, 'n_features_in_'):
        print(f'  Features: {v.n_features_in_}')
    if hasattr(v, 'feature_names_in_'):
        print(f'  Feature names: {list(v.feature_names_in_)}')
    if hasattr(v, 'get_params'):
        p = v.get_params()
        print(f'  n_estimators: {p.get("n_estimators")}')
        print(f'  max_depth: {p.get("max_depth")}')
