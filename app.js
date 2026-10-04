/* ==========================================================================
   JAVASCRIPT THERMODYNAMIC ENGINE & INTERACTIVE USER-EDITABLE SIMULATION
   ========================================================================== */

// BANQUE DE DONNÉES THERMODYNAMIQUES DES COMPOSÉS
const COMPOUNDS_DB = {
    acetone: {
        name: 'Acétone',
        formula: 'C3H6O',
        molarMass: 0.05808,  // kg/mol
        Tc: 508.1,           // K
        Tb0: 329.34,         // K à 1 atm
        DH_vap_0: 29.10,     // kJ/mol
        A: 7.02447,
        B: 1161.0,
        C: 224.0,
        cp_base: 125.5,
        cp_slope: 0.16
    },
    water: {
        name: 'Eau',
        formula: 'H2O',
        molarMass: 0.018015,
        Tc: 647.1,
        Tb0: 373.15,
        DH_vap_0: 40.65,
        A: 8.07131,
        B: 1730.63,
        C: 233.426,
        cp_base: 75.3,
        cp_slope: 0.02
    },
    ethanol: {
        name: 'Éthanol',
        formula: 'C2H5OH',
        molarMass: 0.04607,
        Tc: 514.0,
        Tb0: 351.44,
        DH_vap_0: 38.56,
        A: 8.20417,
        B: 1642.89,
        C: 230.3,
        cp_base: 112.4,
        cp_slope: 0.25
    },
    methanol: {
        name: 'Méthanol',
        formula: 'CH3OH',
        molarMass: 0.03204,
        Tc: 512.6,
        Tb0: 337.8,
        DH_vap_0: 35.21,
        A: 8.08097,
        B: 1582.24,
        C: 239.7,
        cp_base: 81.6,
        cp_slope: 0.18
    },
    benzene: {
        name: 'Benzène',
        formula: 'C6H6',
        molarMass: 0.07811,
        Tc: 562.2,
        Tb0: 353.24,
        DH_vap_0: 30.72,
        A: 6.90565,
        B: 1211.033,
        C: 220.79,
        cp_base: 136.0,
        cp_slope: 0.22
    },
    toluene: {
        name: 'Toluène',
        formula: 'C7H8',
        molarMass: 0.09214,
        Tc: 591.8,
        Tb0: 383.78,
        DH_vap_0: 33.18,
        A: 6.95464,
        B: 1343.94,
        C: 219.38,
        cp_base: 156.0,
        cp_slope: 0.30
    }
};

let activeCompound = COMPOUNDS_DB.acetone;

/**
 * Capacité thermique liquide massique Cp(T) en J/(kg.K)
 */
function getCpLiquidMass(T_k, comp = activeCompound) {
    const cp_molar = comp.cp_base + comp.cp_slope * (T_k - 298.15);
    return cp_molar / comp.molarMass;
}

/**
 * Calcule la température d'ébullition (°C et K) via l'équation d'Antoine inverse.
 */
function calcTebullitionAntoine(P_atm, A, B, C) {
    const P_mmHg = P_atm * 760.0;
    const denominator = A - Math.log10(P_mmHg);
    if (denominator <= 0) return { c: 999.0, k: 1272.15 }; // Éviter division par zéro/négatif
    const T_celsius = B / denominator - C;
    const T_kelvin = T_celsius + 273.15;
    return { c: T_celsius, k: T_kelvin };
}

/**
 * Calcule l'enthalpie de vaporisation (J/kg) via la relation de Watson
 */
function calcDHVap(T_k, comp = activeCompound) {
    const Tr = Math.min(T_k / comp.Tc, 0.999);
    const Tr0 = comp.Tb0 / comp.Tc;
    const DH_vap_0_j_kg = (comp.DH_vap_0 * 1000.0) / comp.molarMass;
    return DH_vap_0_j_kg * Math.pow((1.0 - Tr) / (1.0 - Tr0), 0.38);
}

/**
 * Calcul complet du bilan d'énergie dans le Heater
 */
function calculateSimulation(P_atm, m_feed_total, split_pct, T_in_celsius, customAntoine = null) {
    const A = customAntoine ? customAntoine.A : activeCompound.A;
    const B = customAntoine ? customAntoine.B : activeCompound.B;
    const C = customAntoine ? customAntoine.C : activeCompound.C;

    const m_stream_1 = ((100.0 - split_pct) / 100.0) * m_feed_total;
    const m_stream_2 = (split_pct / 100.0) * m_feed_total;

    const T_in_k = T_in_celsius + 273.15;
    const Teb = calcTebullitionAntoine(P_atm, A, B, C);

    // Intégration numérique par méthode des trapèzes
    const steps = 150;
    const dT = (Teb.k - T_in_k) / steps;
    let sensible_j_kg = 0.0;

    for (let i = 0; i < steps; i++) {
        const T1 = T_in_k + i * dT;
        const T2 = T1 + dT;
        const cp1 = getCpLiquidMass(T1);
        const cp2 = getCpLiquidMass(T2);
        sensible_j_kg += 0.5 * (cp1 + cp2) * dT;
    }

    // Enthalpie de vaporisation à Teb
    const dh_vap_j_kg = calcDHVap(Teb.k);

    const m_kg_s = m_stream_2 / 3600.0;
    const dh_total_j_kg = sensible_j_kg + dh_vap_j_kg;
    const Q_total_w = m_kg_s * dh_total_j_kg;
    const Q_total_kw = Q_total_w / 1000.0;
    const Q_total_kj_h = (dh_total_j_kg * m_stream_2) / 1000.0;

    const Q_sensible_kj_h = (sensible_j_kg * m_stream_2) / 1000.0;
    const Q_latente_kj_h = (dh_vap_j_kg * m_stream_2) / 1000.0;

    return {
        P_atm,
        m_feed_total,
        m_stream_1,
        m_stream_2,
        T_in_celsius,
        Teb_c: Teb.c,
        Teb_k: Teb.k,
        dh_sensible_kj_kg: sensible_j_kg / 1000.0,
        dh_vap_kj_kg: dh_vap_j_kg / 1000.0,
        dh_total_kj_kg: dh_total_j_kg / 1000.0,
        Q_sensible_kj_h,
        Q_latente_kj_h,
        Q_total_kj_h,
        Q_total_kw,
        A, B, C
    };
}

// ==========================================================================
// INTERACTIVE DOM & BIDIRECTIONAL BINDING
// ==========================================================================

let sensitivityChart = null;

document.addEventListener('DOMContentLoaded', () => {
    // Controls: Inputs & Sliders
    const pInput = document.getElementById('p-input');
    const pSlider = document.getElementById('p-slider');

    const mInput = document.getElementById('m-input');
    const mSlider = document.getElementById('m-slider');

    const splitInput = document.getElementById('split-input');
    const splitSlider = document.getElementById('split-slider');

    const tinInput = document.getElementById('tin-input');
    const tinSlider = document.getElementById('tin-slider');

    // Advanced Antoine Inputs
    const antA = document.getElementById('ant-a');
    const antB = document.getElementById('ant-b');
    const antC = document.getElementById('ant-c');

    const compoundSelect = document.getElementById('compound-select');

    // Sub-labels & Theory Text
    const valSplit1 = document.getElementById('val-split1-pct');
    const valSplit2 = document.getElementById('val-split2-pct');

    const theoryA = document.getElementById('theory-a');
    const theoryB = document.getElementById('theory-b');
    const theoryC = document.getElementById('theory-c');

    // KPI Cards
    const kpiTeb = document.getElementById('kpi-teb');
    const kpiTebK = document.getElementById('kpi-teb-k');
    const kpiPower = document.getElementById('kpi-power');
    const kpiEnergyKj = document.getElementById('kpi-energy-kj');
    const kpiDhvap = document.getElementById('kpi-dhvap');
    const kpiVaporFlow = document.getElementById('kpi-vapor-flow');

    // PFD Text Labels
    const pfdStr01 = document.getElementById('pfd-str01-info');
    const pfdStr02 = document.getElementById('pfd-str02-info');
    const pfdStr03 = document.getElementById('pfd-str03-info');
    const pfdStr04 = document.getElementById('pfd-str04-info');
    const pfdEnergy = document.getElementById('pfd-energy-info');

    const pfdStr02Title = document.getElementById('pfd-str02-title');
    const pfdStr03Title = document.getElementById('pfd-str03-title');

    const btnReset = document.getElementById('btn-reset');

    // Initialize Chart
    initChart();

    // BIDIRECTIONAL SYNCHRONIZATION HELPERS
    function syncInputToSlider(inputEl, sliderEl) {
        let val = parseFloat(inputEl.value);
        if (isNaN(val)) return;
        // Adjust slider if value exceeds bounds
        if (val > parseFloat(sliderEl.max)) sliderEl.max = Math.max(val, 100);
        if (val < parseFloat(sliderEl.min) && val >= 0) sliderEl.min = Math.min(val, 0);
        sliderEl.value = val;
    }

    function syncSliderToInput(sliderEl, inputEl) {
        inputEl.value = parseFloat(sliderEl.value).toFixed(inputEl.step.includes('.') ? inputEl.step.split('.')[1].length : 0);
    }

    // MAIN RECALCULATION & UI UPDATE
    function updateApp() {
        const P = parseFloat(pInput.value) || 1.0;
        const mFeed = parseFloat(mInput.value) || 38.0;
        const splitPct = parseFloat(splitInput.value) || 60.0;
        const Tin = parseFloat(tinInput.value) || 10.0;

        const customAntoine = {
            A: parseFloat(antA.value) || activeCompound.A,
            B: parseFloat(antB.value) || activeCompound.B,
            C: parseFloat(antC.value) || activeCompound.C
        };

        // Text Sublabels
        valSplit1.textContent = `${(100 - splitPct).toFixed(0)}%`;
        valSplit2.textContent = `${splitPct.toFixed(0)}%`;

        pfdStr02Title.textContent = `STR-02 (Flux 1 - ${(100 - splitPct).toFixed(0)}%)`;
        pfdStr03Title.textContent = `STR-03 (Flux 2 - ${splitPct.toFixed(0)}%)`;

        theoryA.textContent = customAntoine.A;
        theoryB.textContent = customAntoine.B;
        theoryC.textContent = customAntoine.C;

        // Perform Simulation Calculation
        const res = calculateSimulation(P, mFeed, splitPct, Tin, customAntoine);

        // Update KPIs
        kpiTeb.textContent = res.Teb_c.toFixed(2);
        kpiTebK.textContent = `${res.Teb_k.toFixed(2)} K`;
        kpiPower.textContent = res.Q_total_kw.toFixed(3);
        kpiEnergyKj.textContent = `${res.Q_total_kj_h.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} kJ/h`;
        kpiDhvap.textContent = res.dh_vap_kj_kg.toFixed(2);
        kpiVaporFlow.textContent = res.m_stream_2.toFixed(2);

        // Update PFD Text
        pfdStr01.textContent = `${mFeed.toFixed(1)} kg/h | ${Tin.toFixed(1)} °C`;
        pfdStr02.textContent = `${res.m_stream_1.toFixed(1)} kg/h | Liquide`;
        pfdStr03.textContent = `${res.m_stream_2.toFixed(1)} kg/h | Liquide`;
        pfdStr04.textContent = `${res.m_stream_2.toFixed(1)} kg/h | T_eb: ${res.Teb_c.toFixed(1)} °C`;
        pfdEnergy.textContent = `Q = ${res.Q_total_kw.toFixed(3)} kW`;

        // Update Chart
        updateChartData(mFeed, splitPct, Tin, customAntoine);
    }

    // EVENT LISTENERS FOR BIDIRECTIONAL EDITING
    pInput.addEventListener('input', () => { syncInputToSlider(pInput, pSlider); updateApp(); });
    pSlider.addEventListener('input', () => { syncSliderToInput(pSlider, pInput); updateApp(); });

    mInput.addEventListener('input', () => { syncInputToSlider(mInput, mSlider); updateApp(); });
    mSlider.addEventListener('input', () => { syncSliderToInput(mSlider, mInput); updateApp(); });

    splitInput.addEventListener('input', () => { syncInputToSlider(splitInput, splitSlider); updateApp(); });
    splitSlider.addEventListener('input', () => { syncSliderToInput(splitSlider, splitInput); updateApp(); });

    tinInput.addEventListener('input', () => { syncInputToSlider(tinInput, tinSlider); updateApp(); });
    tinSlider.addEventListener('input', () => { syncSliderToInput(tinSlider, tinInput); updateApp(); });

    // Advanced Antoine Coefficients Inputs
    antA.addEventListener('input', updateApp);
    antB.addEventListener('input', updateApp);
    antC.addEventListener('input', updateApp);

    // Fluid Selector Change
    compoundSelect.addEventListener('change', (e) => {
        const key = e.target.value;
        if (COMPOUNDS_DB[key]) {
            activeCompound = COMPOUNDS_DB[key];
            antA.value = activeCompound.A;
            antB.value = activeCompound.B;
            antC.value = activeCompound.C;
            updateApp();
        }
    });

    // Reset Button
    btnReset.addEventListener('click', () => {
        compoundSelect.value = 'acetone';
        activeCompound = COMPOUNDS_DB.acetone;

        pInput.value = "1.00";
        pSlider.value = 1.0;

        mInput.value = "38.0";
        mSlider.value = 38.0;

        splitInput.value = "60";
        splitSlider.value = 60;

        tinInput.value = "10.0";
        tinSlider.value = 10.0;

        antA.value = activeCompound.A;
        antB.value = activeCompound.B;
        antC.value = activeCompound.C;

        updateApp();
    });

    // Initial Calculation Run
    updateApp();
});

// ==========================================================================
// CHART.JS SENSITIVITY CURVE
// ==========================================================================

function initChart() {
    const ctx = document.getElementById('sensitivityChart').getContext('2d');

    sensitivityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: "Température d'Ébullition (°C)",
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2.5,
                    yAxisID: 'yTeb',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 6
                },
                {
                    label: 'Puissance Heater (kW)',
                    data: [],
                    borderColor: '#ef4444',
                    borderWidth: 2.5,
                    borderDash: [5, 5],
                    yAxisID: 'yPower',
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#f8fafc',
                        font: { family: 'Outfit', size: 12, weight: '600' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#38bdf8',
                    bodyColor: '#f8fafc',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderWidth: 1,
                    padding: 12
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Pression du système (atm)',
                        color: '#94a3b8',
                        font: { family: 'Outfit', size: 12, weight: '600' }
                    },
                    ticks: { color: '#64748b' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                yTeb: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: "Température d'ébullition (°C)",
                        color: '#3b82f6',
                        font: { family: 'Outfit', size: 12, weight: '600' }
                    },
                    ticks: { color: '#60a5fa' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                yPower: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Puissance Heater (kW)',
                        color: '#ef4444',
                        font: { family: 'Outfit', size: 12, weight: '600' }
                    },
                    ticks: { color: '#f87171' },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

function updateChartData(mFeed, splitPct, Tin, customAntoine) {
    if (!sensitivityChart) return;

    const pArray = [];
    const tebArray = [];
    const powerArray = [];

    const steps = 60;
    for (let i = 0; i <= steps; i++) {
        const p = 0.1 + (i / steps) * (3.0 - 0.1);
        const res = calculateSimulation(p, mFeed, splitPct, Tin, customAntoine);

        pArray.push(p.toFixed(2));
        tebArray.push(res.Teb_c.toFixed(2));
        powerArray.push(res.Q_total_kw.toFixed(3));
    }

    sensitivityChart.data.labels = pArray;
    sensitivityChart.data.datasets[0].data = tebArray;
    sensitivityChart.data.datasets[1].data = powerArray;
    sensitivityChart.update('none');
}
