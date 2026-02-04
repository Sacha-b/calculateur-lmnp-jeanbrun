import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend, CartesianGrid } from "recharts";

// ==================== CONSTANTS ====================
const BRACKETS = [
  { limit: 11497, rate: 0 },
  { limit: 29315, rate: 0.11 },
  { limit: 83823, rate: 0.30 },
  { limit: 180294, rate: 0.41 },
  { limit: Infinity, rate: 0.45 },
];

const JB = {
  intermédiaire: { neuf: 0.035, ancien: 0.03, cap: 8000, décote: 0.15, label: "Intermédiaire" },
  social: { neuf: 0.045, ancien: 0.035, cap: 10000, décote: 0.30, label: "Social" },
  très_social: { neuf: 0.055, ancien: 0.04, cap: 12000, décote: 0.45, label: "Très social" },
};

const PS_FONCIER = 0.172;
const PS_BIC = 0.186;
const IR_PV = 0.19;
const PS_PV = 0.172;

// ==================== HELPERS ====================
const fmt = (n) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n));
const fmtE = (n) => `${fmt(n)} €`;
const fmtP = (n) => `${(n * 100).toFixed(1).replace(".", ",")} %`;

function calcIR(income, parts) {
  if (income <= 0) return 0;
  const q = income / parts;
  let tax = 0, prev = 0;
  for (const b of BRACKETS) {
    if (q > prev) tax += (Math.min(q, b.limit) - prev) * b.rate;
    prev = b.limit;
  }
  return tax * parts;
}

function margRate(income, parts) {
  if (income <= 0) return 0;
  const q = income / parts;
  for (const b of BRACKETS) if (q <= b.limit) return b.rate;
  return 0.45;
}

function pvAbatIR(y) {
  if (y <= 5) return 0;
  if (y >= 22) return 1;
  return Math.min(Math.min(y - 5, 16) * 0.06 + (y >= 22 ? 0.04 : 0), 1);
}

function pvAbatPS(y) {
  if (y <= 5) return 0;
  if (y >= 30) return 1;
  let a = Math.min(y - 5, 16) * 0.0165;
  if (y >= 22) a += 0.016;
  if (y > 22) a += Math.min(y - 22, 8) * 0.09;
  return Math.min(a, 1);
}

function pvSurtax(pv) {
  if (pv <= 50000) return 0;
  if (pv <= 60000) return 0.02 * pv - (60000 - pv) / 20;
  if (pv <= 100000) return 0.02 * pv;
  if (pv <= 110000) return 0.03 * pv - (110000 - pv) / 10;
  if (pv <= 150000) return 0.03 * pv;
  if (pv <= 160000) return 0.04 * pv - (160000 - pv) * 0.15;
  if (pv <= 200000) return 0.04 * pv;
  if (pv <= 210000) return 0.05 * pv - (210000 - pv) * 0.2;
  if (pv <= 250000) return 0.05 * pv;
  if (pv <= 260000) return 0.06 * pv - (260000 - pv) * 0.25;
  return 0.06 * pv;
}

// ==================== INPUT COMPONENT ====================
function Input({ label, value, onChange, suffix, min, max, step, note, type = "number" }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: "#64748b", fontFamily: "'Manrope', sans-serif" }}>
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
          min={min}
          max={max}
          step={step || 1}
          className="w-full rounded-lg border px-3 py-2.5 text-sm font-medium outline-none transition-all focus:ring-2"
          style={{
            borderColor: "#e2e8f0",
            fontFamily: "'Manrope', sans-serif",
            color: "#1e293b",
            backgroundColor: "#fff",
          }}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{ color: "#94a3b8" }}>
            {suffix}
          </span>
        )}
      </div>
      {note && <span className="text-xs" style={{ color: "#94a3b8" }}>{note}</span>}
    </div>
  );
}

function Select({ label, value, onChange, options, note }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: "#64748b", fontFamily: "'Manrope', sans-serif" }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2.5 text-sm font-medium outline-none transition-all focus:ring-2"
        style={{ borderColor: "#e2e8f0", fontFamily: "'Manrope', sans-serif", color: "#1e293b", backgroundColor: "#fff" }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {note && <span className="text-xs" style={{ color: "#94a3b8" }}>{note}</span>}
    </div>
  );
}

// ==================== DETAIL ROW ====================
function Row({ label, jb, lmnp, bold, highlight, indent }) {
  const style = bold
    ? { fontWeight: 700, fontSize: "0.95rem" }
    : { fontWeight: 500, fontSize: "0.8125rem" };
  const bgJB = highlight === "jb" ? "rgba(26,181,183,0.08)" : "transparent";
  const bgLMNP = highlight === "lmnp" ? "rgba(232,74,62,0.06)" : "transparent";
  return (
    <div className="grid grid-cols-3 items-center border-b" style={{ borderColor: "#f1f5f9" }}>
      <div className="py-2 pr-2" style={{ ...style, color: "#475569", paddingLeft: indent ? 16 : 0, fontFamily: "'Manrope', sans-serif" }}>
        {label}
      </div>
      <div className="py-2 text-right pr-4" style={{ ...style, color: "#0e7c7b", background: bgJB, fontFamily: "'Crimson Pro', serif" }}>
        {jb}
      </div>
      <div className="py-2 text-right pr-4" style={{ ...style, color: "#c43a30", background: bgLMNP, fontFamily: "'Crimson Pro', serif" }}>
        {lmnp}
      </div>
    </div>
  );
}

// ==================== CUSTOM TOOLTIP ====================
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg p-3 shadow-lg" style={{ backgroundColor: "#1e293b", border: "1px solid #334155" }}>
      <p className="text-xs font-semibold mb-1" style={{ color: "#e2e8f0", fontFamily: "'Manrope', sans-serif" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs" style={{ color: p.color, fontFamily: "'Crimson Pro', serif" }}>
          {p.name}: {fmtE(p.value)}
        </p>
      ))}
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
export default function App() {
  const [prix, setPrix] = useState(200000);
  const [typeBien, setTypeBien] = useState("neuf");
  const [travaux, setTravaux] = useState(70000);
  const [loyerMarche, setLoyerMarche] = useState(800);
  const [niveau, setNiveau] = useState("intermédiaire");
  const [revenu, setRevenu] = useState(35000);
  const parts = 1;
  const [charges, setCharges] = useState(2400);
  const [tauxLMNP, setTauxLMNP] = useState(3.0);
  const [duree, setDuree] = useState(15);
  const [tab, setTab] = useState("annuel");

  const travauxMin = Math.ceil(prix * 0.3);
  const travauxValid = typeBien === "ancien" ? travaux >= travauxMin : true;

  // ==================== CALCULATIONS ====================
  const R = useMemo(() => {
    const jb = JB[niveau];

    // --- PRIX DE REVENTE (inflation 1,6 %/an) ---
    const baseValeur = typeBien === "neuf" ? prix : prix + travaux;
    const prixVente = Math.round(baseValeur * Math.pow(1.016, duree));

    // --- JEANBRUN ANNUAL ---
    const loyerJB = Math.round(loyerMarche * (1 - jb.décote)) * 12;
    const baseJB = typeBien === "neuf" ? prix * 0.8 : (prix + travaux) * 0.8;
    const tauxJBVal = typeBien === "neuf" ? jb.neuf : jb.ancien;
    const amortCalcJB = baseJB * tauxJBVal;
    const amortJB = Math.min(amortCalcJB, jb.cap);
    const foncierBrut = loyerJB - charges;
    const foncierNet = loyerJB - charges - amortJB;

    let irJB, psJB, deficitJB = 0;
    if (foncierNet >= 0) {
      irJB = calcIR(revenu + foncierNet, parts) - calcIR(revenu, parts);
      psJB = foncierNet * PS_FONCIER;
    } else {
      deficitJB = Math.min(Math.abs(foncierNet), 10700);
      irJB = -(calcIR(revenu, parts) - calcIR(Math.max(0, revenu - deficitJB), parts));
      psJB = 0;
    }
    const taxJB = irJB + psJB;
    const netJB = loyerJB - charges - taxJB;

    // --- LMNP ANNUAL ---
    const loyerLMNP = loyerMarche * 12;
    const baseLMNP = typeBien === "neuf" ? prix : prix + travaux;
    const amortCalcLMNP = baseLMNP * (tauxLMNP / 100);
    const bicAvant = loyerLMNP - charges;
    const amortDedLMNP = bicAvant > 0 ? Math.min(amortCalcLMNP, bicAvant) : 0;
    const amortRepLMNP = amortCalcLMNP - amortDedLMNP;
    const bicNet = Math.max(0, bicAvant - amortDedLMNP);

    const irLMNP = bicNet > 0 ? calcIR(revenu + bicNet, parts) - calcIR(revenu, parts) : 0;
    const psLMNP = bicNet > 0 ? bicNet * PS_BIC : 0;
    const taxLMNP = irLMNP + psLMNP;
    const netLMNP = loyerLMNP - charges - taxLMNP;

    // --- YEAR-BY-YEAR SIMULATION ---
    let totalTaxJBPeriod = 0, totalAmortJBPeriod = 0, remainJB = baseJB;
    let carryDeficit = 0;
    const yearDataJB = [];

    for (let y = 1; y <= duree; y++) {
      const amY = Math.min(amortJB, remainJB);
      remainJB = Math.max(0, remainJB - amY);
      totalAmortJBPeriod += amY;

      let fn = loyerJB - charges - amY;
      if (fn > 0 && carryDeficit > 0) {
        const used = Math.min(fn, carryDeficit);
        fn -= used;
        carryDeficit -= used;
      }

      let irY, psY;
      if (fn >= 0) {
        irY = calcIR(revenu + fn, parts) - calcIR(revenu, parts);
        psY = fn * PS_FONCIER;
      } else {
        const imp = Math.min(Math.abs(fn), 10700);
        const exc = Math.abs(fn) - imp;
        carryDeficit += exc;
        irY = -(calcIR(revenu, parts) - calcIR(Math.max(0, revenu - imp), parts));
        psY = 0;
      }
      totalTaxJBPeriod += irY + psY;
      yearDataJB.push({ year: y, tax: irY + psY, net: loyerJB - charges - (irY + psY) });
    }

    let totalTaxLMNPPeriod = 0, totalAmortLMNPPeriod = 0, remainLMNP = baseLMNP;
    let amortReport = 0;
    const yearDataLMNP = [];

    for (let y = 1; y <= duree; y++) {
      const newAm = Math.min(amortCalcLMNP, remainLMNP);
      remainLMNP = Math.max(0, remainLMNP - newAm);
      const avail = newAm + amortReport;
      const ba = loyerLMNP - charges;
      const ded = ba > 0 ? Math.min(avail, ba) : 0;
      totalAmortLMNPPeriod += ded;
      amortReport = avail - ded;
      const bn = Math.max(0, ba - ded);
      const irY = bn > 0 ? calcIR(revenu + bn, parts) - calcIR(revenu, parts) : 0;
      const psY = bn > 0 ? bn * PS_BIC : 0;
      totalTaxLMNPPeriod += irY + psY;
      yearDataLMNP.push({ year: y, tax: irY + psY, net: loyerLMNP - charges - (irY + psY) });
    }

    const totalLoyerJB = loyerJB * duree;
    const totalLoyerLMNP = loyerLMNP * duree;
    const totalCharges = charges * duree;
    const totalNetJB = totalLoyerJB - totalCharges - totalTaxJBPeriod;
    const totalNetLMNP = totalLoyerLMNP - totalCharges - totalTaxLMNPPeriod;

    // --- PLUS-VALUE ---
    const frais = prix * 0.075;
    const travauxPVJB = duree > 5 ? Math.max(typeBien === "ancien" ? travaux : 0, prix * 0.15) : (typeBien === "ancien" ? travaux : 0);
    const travauxPVLMNP = travauxPVJB; // same property
    const prixCorrige = prix + frais + travauxPVJB;

    const pvBruteBase = prixVente - prixCorrige;
    const pvBruteJB = pvBruteBase + totalAmortJBPeriod;
    const pvBruteLMNP = pvBruteBase + totalAmortLMNPPeriod;

    const aIR = pvAbatIR(duree);
    const aPS = pvAbatPS(duree);

    const calc_pv = (pvBrute) => {
      if (pvBrute <= 0) return { pvIR: 0, pvPS: 0, ir: 0, ps: 0, surtax: 0, total: 0, pvBrute };
      const pvIR = pvBrute * (1 - aIR);
      const pvPS = pvBrute * (1 - aPS);
      const ir = pvIR * IR_PV;
      const ps = pvPS * PS_PV;
      const st = pvSurtax(pvIR);
      return { pvIR, pvPS, ir, ps, surtax: st, total: ir + ps + st, pvBrute };
    };

    const pvJB = calc_pv(pvBruteJB);
    const pvLMNP = calc_pv(pvBruteLMNP);

    // --- BILAN GLOBAL ---
    const bilanJB = totalNetJB - pvJB.total;
    const bilanLMNP = totalNetLMNP - pvLMNP.total;
    const avantage = bilanLMNP - bilanJB; // positive = LMNP better

    // Chart data
    const chartAnnuel = [
      { name: "Loyer annuel", JB: loyerJB, LMNP: loyerLMNP },
      { name: "Charges", JB: charges, LMNP: charges },
      { name: "Impôt total", JB: Math.max(0, taxJB), LMNP: Math.max(0, taxLMNP) },
      { name: "Net perçu", JB: netJB, LMNP: netLMNP },
    ];

    const chartGlobal = [
      { name: "Loyers cumulés", JB: totalLoyerJB, LMNP: totalLoyerLMNP },
      { name: "Impôts cumulés", JB: Math.max(0, totalTaxJBPeriod), LMNP: Math.max(0, totalTaxLMNPPeriod) },
      { name: "Impôt PV", JB: pvJB.total, LMNP: pvLMNP.total },
      { name: "Bilan net", JB: bilanJB, LMNP: bilanLMNP },
    ];

    return {
      prixVente,
      loyerJB, baseJB, tauxJBVal, amortCalcJB, amortJB, foncierBrut, foncierNet,
      irJB, psJB, taxJB, netJB, deficitJB,
      loyerLMNP, baseLMNP, amortCalcLMNP, amortDedLMNP, amortRepLMNP,
      bicAvant, bicNet, irLMNP, psLMNP, taxLMNP, netLMNP,
      totalAmortJBPeriod, totalAmortLMNPPeriod,
      totalLoyerJB, totalLoyerLMNP, totalCharges,
      totalTaxJBPeriod, totalTaxLMNPPeriod, totalNetJB, totalNetLMNP,
      frais, travauxPVJB, prixCorrige, pvBruteBase,
      aIR, aPS, pvJB, pvLMNP,
      bilanJB, bilanLMNP, avantage,
      chartAnnuel, chartGlobal,
      yearDataJB, yearDataLMNP,
      jbConfig: jb,
      mr: margRate(revenu, parts),
      mrJB: foncierNet > 0 ? margRate(revenu + foncierNet, parts) : margRate(revenu, parts),
      mrLMNP: bicNet > 0 ? margRate(revenu + bicNet, parts) : margRate(revenu, parts),
    };
  }, [prix, typeBien, travaux, loyerMarche, niveau, revenu, charges, tauxLMNP, duree]);

  // ==================== RENDER ====================
  const JB_COLOR = "#0e7c7b";
  const LMNP_COLOR = "#e84a3e";
  const tabStyle = (t) => ({
    fontFamily: "'Manrope', sans-serif",
    fontWeight: 600,
    fontSize: "0.8125rem",
    padding: "10px 20px",
    borderRadius: "8px 8px 0 0",
    cursor: "pointer",
    transition: "all 0.2s",
    border: "none",
    borderBottom: tab === t ? "3px solid #1ab5b7" : "3px solid transparent",
    backgroundColor: tab === t ? "#fff" : "transparent",
    color: tab === t ? "#1e293b" : "#94a3b8",
  });

  return (
    <div style={{ fontFamily: "'Manrope', sans-serif", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');
        input[type=number]::-webkit-inner-spin-button { opacity: 0.3; }
        select { cursor: pointer; }
        * { box-sizing: border-box; }
        input:focus, select:focus { ring-color: #1ab5b7; border-color: #1ab5b7 !important; box-shadow: 0 0 0 2px rgba(26,181,183,0.2) !important; }
      `}</style>

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg, #0d4f4f 0%, #127a7a 40%, #1ab5b7 100%)", padding: "24px 24px 18px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", gap: 16 }}>
          {/* MyNotary Logo */}
          <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAAAwCAYAAACynDzrAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAAHiUlEQVR42u2ae2wU1xXGf3dm9r1e/MLgJzavIMAJjXFUhUBLFKlSoypKqxRQmqSp1JZEolJCpKhRVLWVWqFUCmoRUtUqQhFpo0hBjZqkSqBNCgQhE0LBvB1jbPCuXxjjtb2zszNzb//YWbOmpApQZ2m8Rxrt3N17Z+98c853vnN2hVJKUbTPNK0IQRGgIkBFgIoAFQEqAlQEaIaacTttxvU0qyYEoghQnkkJQqALMQWs/PHMBMgDBk3DBv4Wj5OSknV1dehCIPM8qlAmClaLSQmahgQ4uJ+t5zr5aWU1IcvinvJynr9jMQ9UzclOVapgIBWGpJUCTSPTcZrhnz+P9dzTXPq0g3AozGyfj3+NjrKu7RBPHD7MqWQSTQjUjAkxJUFojO18hYlX/4irFCIcIRAOoymFAmI+A6Ukb/cl2DPQz4tLlvDUgoUF8aQv2IMUCA3lupjv/RUEiFgM4bqMmSlGbJuRTIbLGQdTBQj7SpggwLbzcWxXFsSTjC8aH0TWi0QwBJqG5jhM+Hysv+9rtCxfTsB26E6N8+dzp0mFMFXgbOqX/BgkNTOlX6cJ4BpdVeDrSQaduyzWDrBmqtTAou48dr3tW8ESOtHBld/kBO1K4mkjlkWPJ0uoYuYak6xte/dbLjq+tbBrm7xANLzz5R8rkxzxZ2cmPJEoZE+FuH07L/rqMtwmDim93AtzSWELmKieZzB2pXc+q6/a6XR5whuTt5dHGHouWbjTYzubRAf+xLLS018UMBUZ91OZxW8hfRAVacOj5FIemC4nW5f51PKm9XmxOEtZrI+wcbiELf+8e0MDAymp+7O8bEr83yGjGI4Do/uYeLANirye3ry0zd+WqF3rjXhdrad9mo48HVqrsy3RlfwZhIQSjvCCEHE4ZOEsvTx3nUf5P2bPowL3bzPDV3AQ3wUcCQKjdo4+chghnbnRUhxIyaMImJt70M/RYTEe3pyvUS51JAs5OTcBT1FKR1iWSZjpkuazsnhtg1AV6UnWibJ2n27p0x6Fx6ad83TVLNcUCYZgAxAJhmADEAmGYAMQCZtk/8HvroykXXaELAAAAAASUVORK5CYII=" alt="MyNotary" style={{ height: 48, borderRadius: 8, backgroundColor: "#fff", padding: "4px 8px" }} />
          <div>
            <h1 style={{ fontFamily: "'Crimson Pro', serif", color: "#fff", fontSize: "1.65rem", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
              Comparateur JeanBrun – LMNP
            </h1>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.8125rem", marginTop: 4, fontWeight: 500, lineHeight: 1.4 }}>
              Location nue avec amortissement vs Location meublée non professionnelle
            </p>
          </div>
        </div>
        <div style={{ maxWidth: 960, margin: "10px auto 0", display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: 6, padding: "4px 10px", fontSize: "0.6875rem", color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
            Barème IR 2025 (revenus 2024)
          </span>
          <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: 6, padding: "4px 10px", fontSize: "0.6875rem", color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
            PS Foncier : 17,2 % · PS BIC : 18,6 %
          </span>
          <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: 6, padding: "4px 10px", fontSize: "0.6875rem", color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
            PV : 19 % IR + 17,2 % PS
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px" }}>

        {/* INPUTS */}
        <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: "20px 24px", marginTop: -8, boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)" }}>
          <h2 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.125rem", fontWeight: 600, color: "#1e293b", margin: "0 0 16px", paddingLeft: 12, borderLeft: "3px solid #1ab5b7" }}>
            Paramètres de simulation
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            <Input label="Prix d'acquisition (HF)" value={prix} onChange={setPrix} suffix="€" min={0} step={5000} note="Hors frais de notaire" />
            <Select
              label="Type de bien (Jeanbrun)"
              value={typeBien}
              onChange={setTypeBien}
              options={[
                { value: "neuf", label: "🏗️ Logement neuf" },
                { value: "ancien", label: "🔨 Ancien + travaux" },
              ]}
            />
            {typeBien === "ancien" && (
              <Input
                label="Montant des travaux"
                value={travaux}
                onChange={setTravaux}
                suffix="€"
                min={0}
                step={5000}
                note={travauxValid ? `Min. 30 % : ${fmtE(travauxMin)}` : `⚠️ Min. requis : ${fmtE(travauxMin)}`}
              />
            )}
            <Input label="Loyer marché mensuel" value={loyerMarche} onChange={setLoyerMarche} suffix="€/mois" min={0} step={50} />
            <Select
              label="Niveau Jeanbrun"
              value={niveau}
              onChange={setNiveau}
              options={[
                { value: "intermédiaire", label: "Intermédiaire (−15 %)" },
                { value: "social", label: "Social (−30 %)" },
                { value: "très_social", label: "Très social (−45 %)" },
              ]}
              note={`Loyer JB : ${fmtE(Math.round(loyerMarche * (1 - JB[niveau].décote)))} /mois`}
            />
            <Input label="Taux amort. LMNP" value={tauxLMNP} onChange={setTauxLMNP} suffix="%" min={2} max={5} step={0.1} note="Comptable : 2,5 à 4 %" />
            <Input label="Salaire net annuel du foyer" value={revenu} onChange={setRevenu} suffix="€/an" min={0} step={1000} note={`TMI actuelle : ${fmtP(R.mr)}`} />
            <Input label="Charges annuelles" value={charges} onChange={setCharges} suffix="€/an" min={0} step={100} note="TF, assurance, gestion…" />
            <Input label="Durée de détention" value={duree} onChange={setDuree} suffix="ans" min={1} max={40} note={`Revente estimée : ${fmtE(R.prixVente)} (+1,6 %/an)`} />
          </div>
        </div>

        {/* SUMMARY BANNER */}
        <div style={{
          marginTop: 16,
          borderRadius: 12,
          padding: "16px 24px",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: 16,
          alignItems: "center",
          background: R.avantage > 0
            ? "linear-gradient(135deg, #fef2f2, #fce8e6)"
            : R.avantage < 0
              ? "linear-gradient(135deg, #f0fdfa, #ccfbf1)"
              : "linear-gradient(135deg, #f8fafc, #f1f5f9)",
          border: `1px solid ${R.avantage > 0 ? "#fecaca" : R.avantage < 0 ? "#99f6e4" : "#e2e8f0"}`,
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: JB_COLOR, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Jeanbrun {JB[niveau].label}
            </div>
            <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.5rem", fontWeight: 700, color: "#1e293b", marginTop: 2 }}>
              {fmtE(R.bilanJB)}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "#64748b" }}>Bilan global sur {duree} ans</div>
          </div>
          <div style={{ textAlign: "center", padding: "8px 16px", borderRadius: 10, backgroundColor: "rgba(255,255,255,0.7)" }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Avantage</div>
            <div style={{
              fontFamily: "'Crimson Pro', serif",
              fontSize: "1.25rem",
              fontWeight: 700,
              color: R.avantage > 0 ? LMNP_COLOR : R.avantage < 0 ? JB_COLOR : "#64748b",
            }}>
              {R.avantage > 0 ? "+" : ""}{fmtE(R.avantage)}
            </div>
            <div style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              color: R.avantage > 0 ? LMNP_COLOR : R.avantage < 0 ? JB_COLOR : "#64748b",
            }}>
              {R.avantage > 0 ? "→ LMNP" : R.avantage < 0 ? "→ Jeanbrun" : "Équivalent"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: LMNP_COLOR, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              LMNP Meublé
            </div>
            <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1.5rem", fontWeight: 700, color: "#1e293b", marginTop: 2 }}>
              {fmtE(R.bilanLMNP)}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "#64748b" }}>Bilan global sur {duree} ans</div>
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: "flex", gap: 4, marginTop: 20, borderBottom: "1px solid #e2e8f0", paddingLeft: 8 }}>
          <button style={tabStyle("annuel")} onClick={() => setTab("annuel")}>📊 Bilan Annuel</button>
          <button style={tabStyle("pv")} onClick={() => setTab("pv")}>🏠 Plus-Value</button>
          <button style={tabStyle("global")} onClick={() => setTab("global")}>💰 Bilan Global</button>
        </div>

        {/* TAB CONTENT */}
        <div style={{ backgroundColor: "#fff", borderRadius: "0 0 12px 12px", padding: "20px 24px", marginBottom: 32, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>

          {/* ===== BILAN ANNUEL ===== */}
          {tab === "annuel" && (
            <div>
              <div className="grid grid-cols-3 items-center border-b pb-2 mb-1" style={{ borderColor: "#e2e8f0" }}>
                <div style={{ fontWeight: 700, fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}></div>
                <div style={{ fontWeight: 700, fontSize: "0.75rem", color: JB_COLOR, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right", paddingRight: 16 }}>
                  Jeanbrun
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.75rem", color: LMNP_COLOR, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right", paddingRight: 16 }}>
                  LMNP
                </div>
              </div>

              <div style={{ marginTop: 4, marginBottom: 8, fontSize: "0.6875rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Revenus locatifs
              </div>
              <Row label="Loyer mensuel" jb={fmtE(R.loyerJB / 12)} lmnp={fmtE(R.loyerLMNP / 12)} />
              <Row label={`Décote appliquée`} jb={`−${(JB[niveau].décote * 100).toFixed(0)} %`} lmnp="—" />
              <Row label="Loyer annuel" jb={fmtE(R.loyerJB)} lmnp={fmtE(R.loyerLMNP)} bold />
              <Row label="− Charges annuelles" jb={fmtE(-charges)} lmnp={fmtE(-charges)} />

              <div style={{ marginTop: 12, marginBottom: 8, fontSize: "0.6875rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Amortissement
              </div>
              <Row label="Base amortissable" jb={fmtE(R.baseJB)} lmnp={fmtE(R.baseLMNP)} />
              <Row label="Taux appliqué" jb={fmtP(R.tauxJBVal)} lmnp={fmtP(tauxLMNP / 100)} />
              <Row label="Amort. calculé" jb={fmtE(R.amortCalcJB)} lmnp={fmtE(R.amortCalcLMNP)} />
              {R.amortCalcJB > R.amortJB && <Row label="Plafond annuel" jb={fmtE(JB[niveau].cap)} lmnp="Aucun" />}
              <Row label="Amort. déduit" jb={fmtE(R.amortJB)} lmnp={fmtE(R.amortDedLMNP)} bold />
              {R.amortRepLMNP > 0 && <Row label="Amort. reporté" jb="—" lmnp={fmtE(R.amortRepLMNP)} indent />}

              <div style={{ marginTop: 12, marginBottom: 8, fontSize: "0.6875rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Imposition
              </div>
              <Row
                label="Revenu net imposable"
                jb={R.foncierNet >= 0 ? fmtE(R.foncierNet) : `Déficit ${fmtE(Math.abs(R.foncierNet))}`}
                lmnp={fmtE(R.bicNet)}
              />
              {R.foncierNet < 0 && (
                <Row label="Déficit imputable (max 10 700 €)" jb={fmtE(R.deficitJB)} lmnp="—" indent />
              )}
              <Row label="TMI avec loyer" jb={fmtP(R.mrJB)} lmnp={fmtP(R.mrLMNP)} />
              <Row
                label="IR sur loyer"
                jb={R.irJB < 0 ? `Économie ${fmtE(Math.abs(R.irJB))}` : fmtE(R.irJB)}
                lmnp={fmtE(R.irLMNP)}
              />
              <Row label="Prélèvements sociaux" jb={`${fmtE(R.psJB)} (17,2 %)`} lmnp={`${fmtE(R.psLMNP)} (18,6 %)`} />
              <Row
                label="Total impôt annuel"
                jb={R.taxJB < 0 ? `Économie ${fmtE(Math.abs(R.taxJB))}` : fmtE(R.taxJB)}
                lmnp={fmtE(R.taxLMNP)}
                bold
                highlight={R.taxJB < R.taxLMNP ? "jb" : "lmnp"}
              />

              <div style={{ height: 1, backgroundColor: "#e2e8f0", margin: "12px 0" }} />
              <Row
                label="Revenu net annuel (après impôt)"
                jb={fmtE(R.netJB)}
                lmnp={fmtE(R.netLMNP)}
                bold
                highlight={R.netJB > R.netLMNP ? "jb" : "lmnp"}
              />
              <Row
                label="Avantage annuel"
                jb={R.netJB > R.netLMNP ? `+${fmtE(R.netJB - R.netLMNP)}` : "—"}
                lmnp={R.netLMNP > R.netJB ? `+${fmtE(R.netLMNP - R.netJB)}` : "—"}
              />

              {/* CHART */}
              <div style={{ marginTop: 24 }}>
                <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1rem", fontWeight: 600, color: "#1e293b", marginBottom: 12 }}>
                  Comparaison visuelle annuelle
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={R.chartAnnuel} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b", fontFamily: "'Manrope', sans-serif" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, fontFamily: "'Manrope', sans-serif" }} />
                    <Bar dataKey="JB" name="Jeanbrun" fill={JB_COLOR} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="LMNP" name="LMNP" fill={LMNP_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* NOTE */}
              <div style={{ marginTop: 16, padding: "12px 16px", backgroundColor: "#fffbeb", borderRadius: 8, border: "1px solid #fef3c7" }}>
                <p style={{ fontSize: "0.75rem", color: "#92400e", lineHeight: 1.6, margin: 0 }}>
                  <strong>💡 Note :</strong> En Jeanbrun, l'amortissement peut créer un déficit foncier imputable sur le revenu global
                  (max. 10 700 €/an), ce qui génère une économie d'IR sur vos autres revenus.
                  En LMNP, l'amortissement ne peut pas créer de déficit : il est plafonné au montant du BIC avant amortissement,
                  l'excédent est reporté indéfiniment.
                </p>
              </div>
            </div>
          )}

          {/* ===== PLUS-VALUE ===== */}
          {tab === "pv" && (
            <div>
              <div className="grid grid-cols-3 items-center border-b pb-2 mb-1" style={{ borderColor: "#e2e8f0" }}>
                <div></div>
                <div style={{ fontWeight: 700, fontSize: "0.75rem", color: JB_COLOR, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right", paddingRight: 16 }}>
                  Jeanbrun
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.75rem", color: LMNP_COLOR, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right", paddingRight: 16 }}>
                  LMNP
                </div>
              </div>

              <div style={{ marginTop: 4, marginBottom: 8, fontSize: "0.6875rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Prix d'acquisition corrigé
              </div>
              <Row label="Prix d'acquisition" jb={fmtE(prix)} lmnp={fmtE(prix)} />
              <Row label="+ Frais forfaitaires (7,5 %)" jb={fmtE(R.frais)} lmnp={fmtE(R.frais)} />
              <Row
                label={duree > 5 ? "+ Travaux (max forfait 15 % / réels)" : "+ Travaux réels"}
                jb={fmtE(R.travauxPVJB)}
                lmnp={fmtE(R.travauxPVJB)}
              />
              <Row label="= Prix corrigé" jb={fmtE(R.prixCorrige)} lmnp={fmtE(R.prixCorrige)} bold />

              <div style={{ marginTop: 12, marginBottom: 8, fontSize: "0.6875rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Calcul de la plus-value
              </div>
              <Row label="Prix de revente" jb={fmtE(R.prixVente)} lmnp={fmtE(R.prixVente)} />
              <Row label="− Prix corrigé" jb={fmtE(-R.prixCorrige)} lmnp={fmtE(-R.prixCorrige)} />
              <Row label="= PV hors réintégration" jb={fmtE(R.pvBruteBase)} lmnp={fmtE(R.pvBruteBase)} />
              <Row
                label={`+ Amort. réintégrés (${duree} ans)`}
                jb={fmtE(R.totalAmortJBPeriod)}
                lmnp={fmtE(R.totalAmortLMNPPeriod)}
                highlight={R.totalAmortJBPeriod < R.totalAmortLMNPPeriod ? "jb" : "lmnp"}
              />
              <Row label="= Plus-value brute" jb={fmtE(R.pvJB.pvBrute)} lmnp={fmtE(R.pvLMNP.pvBrute)} bold />

              <div style={{ marginTop: 12, marginBottom: 8, fontSize: "0.6875rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Abattements pour durée de détention ({duree} ans)
              </div>
              <Row label={`Abattement IR (exo. à 22 ans)`} jb={fmtP(R.aIR)} lmnp={fmtP(R.aIR)} />
              <Row label={`Abattement PS (exo. à 30 ans)`} jb={fmtP(R.aPS)} lmnp={fmtP(R.aPS)} />
              <Row label="PV imposable IR" jb={fmtE(R.pvJB.pvIR)} lmnp={fmtE(R.pvLMNP.pvIR)} />
              <Row label="PV imposable PS" jb={fmtE(R.pvJB.pvPS)} lmnp={fmtE(R.pvLMNP.pvPS)} />

              <div style={{ marginTop: 12, marginBottom: 8, fontSize: "0.6875rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Imposition plus-value
              </div>
              <Row label="IR (19 %)" jb={fmtE(R.pvJB.ir)} lmnp={fmtE(R.pvLMNP.ir)} />
              <Row label="PS (17,2 %)" jb={fmtE(R.pvJB.ps)} lmnp={fmtE(R.pvLMNP.ps)} />
              {(R.pvJB.surtax > 0 || R.pvLMNP.surtax > 0) && (
                <Row label="Surtaxe (PV > 50 000 €)" jb={fmtE(R.pvJB.surtax)} lmnp={fmtE(R.pvLMNP.surtax)} />
              )}
              <div style={{ height: 1, backgroundColor: "#e2e8f0", margin: "8px 0" }} />
              <Row
                label="Total impôt sur plus-value"
                jb={fmtE(R.pvJB.total)}
                lmnp={fmtE(R.pvLMNP.total)}
                bold
                highlight={R.pvJB.total < R.pvLMNP.total ? "jb" : "lmnp"}
              />
              <Row
                label="Gain net de cession"
                jb={fmtE(R.prixVente - prix - R.pvJB.total)}
                lmnp={fmtE(R.prixVente - prix - R.pvLMNP.total)}
                bold
              />

              <div style={{ marginTop: 16, padding: "12px 16px", backgroundColor: "#eff6ff", borderRadius: 8, border: "1px solid #bfdbfe" }}>
                <p style={{ fontSize: "0.75rem", color: "#1e40af", lineHeight: 1.6, margin: 0 }}>
                  <strong>ℹ️ Réintégration des amortissements :</strong> Depuis la LF 2025, les amortissements déduits en LMNP sont réintégrés
                  dans le calcul de la plus-value avant abattement pour durée de détention. Le même principe s'applique au Jeanbrun.
                  Plus l'amortissement cumulé est élevé, plus la PV imposable augmente à la revente.
                </p>
              </div>
            </div>
          )}

          {/* ===== BILAN GLOBAL ===== */}
          {tab === "global" && (
            <div>
              <div className="grid grid-cols-3 items-center border-b pb-2 mb-1" style={{ borderColor: "#e2e8f0" }}>
                <div></div>
                <div style={{ fontWeight: 700, fontSize: "0.75rem", color: JB_COLOR, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right", paddingRight: 16 }}>
                  Jeanbrun
                </div>
                <div style={{ fontWeight: 700, fontSize: "0.75rem", color: LMNP_COLOR, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right", paddingRight: 16 }}>
                  LMNP
                </div>
              </div>

              <div style={{ marginTop: 4, marginBottom: 8, fontSize: "0.6875rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Revenus locatifs cumulés ({duree} ans)
              </div>
              <Row label="Total loyers perçus" jb={fmtE(R.totalLoyerJB)} lmnp={fmtE(R.totalLoyerLMNP)} />
              <Row label="Écart de loyers" jb="—" lmnp={`+${fmtE(R.totalLoyerLMNP - R.totalLoyerJB)}`} />
              <Row label="Total charges" jb={fmtE(-R.totalCharges)} lmnp={fmtE(-R.totalCharges)} />

              <div style={{ marginTop: 12, marginBottom: 8, fontSize: "0.6875rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Fiscalité cumulée
              </div>
              <Row label="Total amort. déduits" jb={fmtE(R.totalAmortJBPeriod)} lmnp={fmtE(R.totalAmortLMNPPeriod)} />
              <Row
                label="Impôts sur revenus locatifs"
                jb={R.totalTaxJBPeriod < 0 ? `Économie ${fmtE(Math.abs(R.totalTaxJBPeriod))}` : fmtE(R.totalTaxJBPeriod)}
                lmnp={fmtE(R.totalTaxLMNPPeriod)}
                highlight={R.totalTaxJBPeriod < R.totalTaxLMNPPeriod ? "jb" : "lmnp"}
              />
              <Row label="Impôt sur plus-value" jb={fmtE(R.pvJB.total)} lmnp={fmtE(R.pvLMNP.total)} highlight={R.pvJB.total < R.pvLMNP.total ? "jb" : "lmnp"} />
              <Row label="Charge fiscale totale" jb={fmtE(Math.max(0, R.totalTaxJBPeriod) + R.pvJB.total)} lmnp={fmtE(Math.max(0, R.totalTaxLMNPPeriod) + R.pvLMNP.total)} bold />

              <div style={{ marginTop: 12, marginBottom: 8, fontSize: "0.6875rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Bilan net
              </div>
              <Row label="Revenus nets cumulés" jb={fmtE(R.totalNetJB)} lmnp={fmtE(R.totalNetLMNP)} />
              <Row label="− Impôt sur PV" jb={fmtE(-R.pvJB.total)} lmnp={fmtE(-R.pvLMNP.total)} />
              <div style={{ height: 2, backgroundColor: "#1e293b", margin: "8px 0" }} />
              <Row
                label={`BILAN GLOBAL sur ${duree} ans`}
                jb={fmtE(R.bilanJB)}
                lmnp={fmtE(R.bilanLMNP)}
                bold
                highlight={R.bilanJB > R.bilanLMNP ? "jb" : "lmnp"}
              />
              <Row
                label="Avantage global"
                jb={R.avantage < 0 ? `+${fmtE(Math.abs(R.avantage))}` : "—"}
                lmnp={R.avantage > 0 ? `+${fmtE(R.avantage)}` : "—"}
              />

              {/* CHART */}
              <div style={{ marginTop: 24 }}>
                <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1rem", fontWeight: 600, color: "#1e293b", marginBottom: 12 }}>
                  Décomposition du bilan global
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={R.chartGlobal} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b", fontFamily: "'Manrope', sans-serif" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, fontFamily: "'Manrope', sans-serif" }} />
                    <Bar dataKey="JB" name="Jeanbrun" fill={JB_COLOR} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="LMNP" name="LMNP" fill={LMNP_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* DECOMPOSITION */}
              <div style={{ marginTop: 24 }}>
                <h3 style={{ fontFamily: "'Crimson Pro', serif", fontSize: "1rem", fontWeight: 600, color: "#1e293b", marginBottom: 12 }}>
                  Décomposition de l'avantage
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {[
                    {
                      title: "Écart de loyers",
                      value: R.totalLoyerLMNP - R.totalLoyerJB,
                      note: "LMNP = loyer marché, JB = loyer décoté",
                      favorise: "LMNP",
                    },
                    {
                      title: "Écart d'impôts locatifs",
                      value: -(R.totalTaxLMNPPeriod - R.totalTaxJBPeriod),
                      note: "IR + PS sur revenus locatifs",
                      favorise: R.totalTaxJBPeriod < R.totalTaxLMNPPeriod ? "Jeanbrun" : "LMNP",
                    },
                    {
                      title: "Écart impôt PV",
                      value: -(R.pvLMNP.total - R.pvJB.total),
                      note: "Impact réintégration amort.",
                      favorise: R.pvJB.total < R.pvLMNP.total ? "Jeanbrun" : "LMNP",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "14px 16px",
                        borderRadius: 10,
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#64748b", marginBottom: 4 }}>
                        {item.title}
                      </div>
                      <div
                        style={{
                          fontFamily: "'Crimson Pro', serif",
                          fontSize: "1.25rem",
                          fontWeight: 700,
                          color: item.value > 0 ? LMNP_COLOR : item.value < 0 ? JB_COLOR : "#64748b",
                        }}
                      >
                        {item.value > 0 ? "+" : ""}{fmtE(item.value)}
                      </div>
                      <div style={{ fontSize: "0.625rem", color: "#94a3b8", marginTop: 2 }}>
                        Favorise {item.favorise}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* NOTES */}
              <div style={{ marginTop: 20, padding: "12px 16px", backgroundColor: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <p style={{ fontSize: "0.6875rem", color: "#64748b", lineHeight: 1.7, margin: 0 }}>
                  <strong>⚙️ Hypothèses :</strong> Simulation sur la base de montants constants (loyer, charges). Le déficit foncier JB
                  est reporté max. 10 ans (simplifié ici). L'amortissement LMNP reporté est consommé dès que le BIC le permet.
                  Les frais de meublage en LMNP ne sont pas inclus. Le bilan ne tient pas compte de la valeur temps de l'argent
                  (pas d'actualisation). Les barèmes utilisés sont ceux de 2025 (revenus 2024). Le PLF 2026 pourrait modifier
                  significativement le régime des plus-values immobilières (suppression des abattements durée de détention, introduction PFU).
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
