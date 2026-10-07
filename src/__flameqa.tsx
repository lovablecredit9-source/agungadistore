import { createRoot } from "react-dom/client";
import StreakFlame from "@/components/streak/StreakFlame";
import { getStreakTier } from "@/components/streak/streakTiers";
const days = [1, 3, 7, 14, 30, 60, 100, 120, 150, 365];
const el = document.createElement("div"); el.id = "qa";
el.style.cssText = "position:fixed;inset:0;z-index:99999;background:#0b0b12;display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:12px;color:#fff;font:12px sans-serif";
document.body.appendChild(el);
createRoot(el).render(<>{days.map(d => <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}><StreakFlame streak={d} size={150} /><b>{d} • {getStreakTier(d).name}</b></div>)}</>);
