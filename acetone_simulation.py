import numpy as np
import matplotlib.pyplot as plt

# ==============================================================================
# PROPRIÉTÉS THERMODYNAMIQUES DE L'ACÉTONE (C3H6O)
# ==============================================================================
MOLAR_MASS = 58.08 / 1000.0  # kg/mol
Tc = 508.1  # Température critique (K)
Pc = 47.0 * 101325  # Pression critique (Pa)
Tb0 = 56.19 + 273.15  # Température d'ébullition normale à 1 atm (K)

# Coefficients d'Antoine (P en mmHg, T en °C) pour l'Acétone
# Range: -13°C à 181°C
A_ant = 7.02447
B_ant = 1161.0
C_ant = 224.0

# Capacité thermique liquide Cp_liq (J/mol.K) en fonction de T (K)
# Cp_liq(T) ≈ 125.5 + 0.16 * (T - 298.15) J/(mol.K)
def cp_liquid_mass(T_k):
    """Capacité thermique massique du liquide (J/kg.K)"""
    cp_molar = 125.5 + 0.16 * (T_k - 298.15)
    return cp_molar / MOLAR_MASS

# Enthalpie de vaporisation à Tb0 (J/kg)
DH_vap_0 = 29.10 * 1000.0 / MOLAR_MASS  # ~501,033 J/kg

def calc_t_ebullition_antoine(P_atm):
    """
    Calcule la température d'ébullition (en °C et K) d'après l'équation d'Antoine inverse.
    P_atm: Pression en atm
    """
    P_mmHg = P_atm * 760.0
    T_celsius = B_ant / (A_ant - np.log10(P_mmHg)) - C_ant
    T_kelvin = T_celsius + 273.15
    return T_celsius, T_kelvin

def calc_dh_vap(T_k):
    """
    Calcule la chaleur latente de vaporisation (J/kg) à la température T_k via la relation de Watson.
    """
    Tr = T_k / Tc
    Tr0 = Tb0 / Tc
    dh_vap = DH_vap_0 * ((1.0 - Tr) / (1.0 - Tr0))**0.38
    return dh_vap

def calc_heater_energy(m_dot_kg_h, T_in_celsius, P_atm):
    """
    Calcule le bilan d'énergie dans le Heater:
    - m_dot_kg_h : débit massique en kg/h
    - T_in_celsius : Température d'entrée (10 °C)
    - P_atm : Pression du système (atm)
    
    Retourne:
    - T_eb_c : Température d'ébullition (°C)
    - Q_sensible_kj_h : Chaleur sensible (kJ/h)
    - Q_latente_kj_h : Chaleur latente de vaporisation (kJ/h)
    - Q_total_kj_h : Chaleur totale nécessaire (kJ/h)
    - Q_total_kw : Puissance en kW
    """
    T_in_k = T_in_celsius + 273.15
    T_eb_c, T_eb_k = calc_t_ebullition_antoine(P_atm)
    
    # 1. Énergie sensible liquide: int_{T_in}^{T_eb} Cp_liq dT
    # Intégration numérique par méthode des trapèzes
    T_steps = np.linspace(T_in_k, T_eb_k, 200)
    cp_steps = cp_liquid_mass(T_steps)  # J/kg.K
    dh_sensible_j_kg = np.trapezoid(cp_steps, T_steps)  # J/kg
    
    # 2. Énergie latente de vaporisation à T_eb
    dh_vap_j_kg = calc_dh_vap(T_eb_k)  # J/kg
    
    # Enthalpie totale massique (J/kg)
    dh_total_j_kg = dh_sensible_j_kg + dh_vap_j_kg
    
    # Conversions pour le débit massique m_dot (kg/h)
    m_dot_kg_s = m_dot_kg_h / 3600.0
    
    Q_total_w = m_dot_kg_s * dh_total_j_kg  # Joules/s = Watts
    Q_total_kw = Q_total_w / 1000.0  # kW
    Q_total_kj_h = dh_total_j_kg * m_dot_kg_h / 1000.0  # kJ/h
    
    Q_sensible_kj_h = dh_sensible_j_kg * m_dot_kg_h / 1000.0
    Q_latente_kj_h = dh_vap_j_kg * m_dot_kg_h / 1000.0
    
    return {
        "T_eb_C": T_eb_c,
        "T_eb_K": T_eb_k,
        "Q_sensible_kJ_h": Q_sensible_kj_h,
        "Q_latente_kJ_h": Q_latente_kj_h,
        "Q_total_kJ_h": Q_total_kj_h,
        "Q_total_kW": Q_total_kw,
        "dh_sensible_kJ_kg": dh_sensible_j_kg / 1000.0,
        "dh_vap_kJ_kg": dh_vap_j_kg / 1000.0,
        "dh_total_kJ_kg": dh_total_j_kg / 1000.0
    }

# ==============================================================================
# SIMULATION DU CAS DE BASE (P = 1 atm, m_total = 38 kg/h, T_in = 10 °C)
# ==============================================================================
m_total = 38.0  # kg/h
m_stream_1 = 0.40 * m_total  # 15.2 kg/h (40%)
m_stream_2 = 0.60 * m_total  # 22.8 kg/h (60%)
T_in = 10.0  # °C
P_base = 1.0  # atm

res_base = calc_heater_energy(m_stream_2, T_in, P_base)

print("="*70)
print(" RESULTATS DE LA SIMULATION DU PROCEDE (CAS DE BASE : 1 atm)")
print("="*70)
print(f"Debi total d'entree (Acetone 10 deg C, 1 atm) : {m_total:.2f} kg/h")
print(f"  |- Flux 1 (40% massique)                : {m_stream_1:.2f} kg/h")
print(f"  |- Flux 2 (60% massique -> Heater)      : {m_stream_2:.2f} kg/h")
print("-" * 70)
print(f"Temperature d'ebullition de l'Acetone a 1 atm  : {res_base['T_eb_C']:.2f} °C ({res_base['T_eb_K']:.2f} K)")
print(f"Chaleur sensible (10 °C -> {res_base['T_eb_C']:.2f} °C)   : {res_base['Q_sensible_kJ_h']:.2f} kJ/h ({res_base['dh_sensible_kJ_kg']:.2f} kJ/kg)")
print(f"Chaleur latente de vaporisation (DH_vap)    : {res_base['Q_latente_kJ_h']:.2f} kJ/h ({res_base['dh_vap_kJ_kg']:.2f} kJ/kg)")
print(f"Energie totale necessaire dans le Heater    : {res_base['Q_total_kJ_h']:.2f} kJ/h ({res_base['Q_total_kW']:.3f} kW)")
print("="*70)

# ==============================================================================
# ÉTUDE DE SENSIBILITÉ (Pression de 0.1 atm à 3.0 atm)
# ==============================================================================
P_range = np.linspace(0.1, 3.0, 100)  # Pression de 0.1 à 3.0 atm
T_eb_list = []
Q_total_kw_list = []
Q_sensible_kw_list = []
Q_latente_kw_list = []

for p in P_range:
    res = calc_heater_energy(m_stream_2, T_in, p)
    T_eb_list.append(res['T_eb_C'])
    Q_total_kw_list.append(res['Q_total_kW'])
    Q_sensible_kw_list.append(res['Q_sensible_kJ_h'] / 3600.0)
    Q_latente_kw_list.append(res['Q_latente_kJ_h'] / 3600.0)

# ==============================================================================
# TRACÉ DE LA COURBE DE SENSIBILITÉ
# ==============================================================================
plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')
fig, ax1 = plt.subplots(figsize=(10, 6), dpi=300)

color = '#1f77b4'
ax1.set_xlabel('Pression (atm)', fontsize=12, fontweight='bold')
ax1.set_ylabel("Température d'ébullition (°C)", color=color, fontsize=12, fontweight='bold')
line1 = ax1.plot(P_range, T_eb_list, color=color, linewidth=2.5, label="T_ébullition (°C)")
ax1.tick_params(axis='y', labelcolor=color)

# Point de base à 1 atm
ax1.plot(1.0, res_base['T_eb_C'], 'ro', markersize=8, label=f"Point d'opération (1 atm, {res_base['T_eb_C']:.2f} °C)")
ax1.annotate(f"  1 atm : {res_base['T_eb_C']:.1f} °C", (1.0, res_base['T_eb_C']), fontsize=10, fontweight='bold', color='red')

# Deuxième axe Y pour la puissance requise en kW
ax2 = ax1.twinx()  
color2 = '#d62728'
ax2.set_ylabel('Puissance requise dans le Heater (kW)', color=color2, fontsize=12, fontweight='bold')
line2 = ax2.plot(P_range, Q_total_kw_list, color=color2, linewidth=2.5, linestyle='--', label="Puissance Heater (kW)")
ax2.tick_params(axis='y', labelcolor=color2)

# Titres et légende combinée
plt.title("Courbe de Sensibilité : Température d'Ébullition & Énergie vs Pression (Acétone)", fontsize=14, fontweight='bold', pad=15)
fig.tight_layout()

# Sauvegarde de la figure
plt.savefig("acetone_sensitivity_curve.png", dpi=300)
print(" Graphique sauvegardé avec succès sous 'acetone_sensitivity_curve.png'.")

# ==============================================================================
# DÉMARRAGE DU SERVEUR WEB INTERACTIF
# ==============================================================================
import server
server.start_server()

