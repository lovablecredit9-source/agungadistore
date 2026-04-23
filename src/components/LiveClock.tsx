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
    <div className="flex items-center gap-3 text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" strokeWidth={1.7} />
        <span className="text-[11px] font-medium tabular-nums text-foreground">
          {hours}:{minutes}:{seconds}
        </span>
      </div>
      <span className="w-px h-3.5 bg-border" />
      <div className="flex items-center gap-1.5">
        <CalendarDays className="w-3.5 h-3.5" strokeWidth={1.7} />
        <span className="text-[11px] font-medium text-foreground">
          {day}, {date} {month} {year}
        </span>
      </div>
    </div>
  );
};

export default LiveClock;
