import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format angka ke format singkat: 65k, 100k, 1jt, 1,5jt (format Indonesia)
export function formatCompactNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1).replace('.', ',').replace(/,0$/, '') + 'M';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace('.', ',').replace(/,0$/, '') + 'jt';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(0) + 'k';
  }
  return num.toString();
}
