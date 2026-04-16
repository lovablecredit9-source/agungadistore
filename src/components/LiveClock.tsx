import { useState, useEffect } from "react";
import { Clock, CalendarDays } from "lucide-react";

const DAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const LiveClock = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const day = DAYS_ID[now.getDay()];
  const date = now.getDate();
  const month = MONTHS_ID[now.getMonth()];
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex items-center gap-1 bg-white/15 backdrop-blur-sm rounded-lg px-2 py-0.5 border border-white/20">
        <Clock className="w-3 h-3 text-white/80" />
        <span className="text-white text-[11px] font-bold tabular-nums tracking-wider">
          {hours}:{minutes}<span className="animate-pulse">:</span>{seconds}
        </span>
      </div>
      <div className="flex items-center gap-1 bg-white/15 backdrop-blur-sm rounded-lg px-2 py-0.5 border border-white/20">
        <CalendarDays className="w-3 h-3 text-white/80" />
        <span className="text-white text-[11px] font-bold">
          {day}, {date} {month} {year}
        </span>
      </div>
    </div>
  );
};

export default LiveClock;
