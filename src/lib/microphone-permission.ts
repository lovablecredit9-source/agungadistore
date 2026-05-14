export async function requestMicrophoneStream(): Promise<MediaStream> {
  if (!window.isSecureContext) {
    throw new Error("Mikrofon hanya bisa dipakai lewat koneksi aman (HTTPS).");
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Browser ini belum mendukung akses mikrofon. Coba pakai Chrome/Edge terbaru.");
  }

  try {
    const status = await navigator.permissions?.query({ name: "microphone" as PermissionName });
    if (status?.state === "denied") {
      throw new Error("Izin mikrofon diblokir. Aktifkan dari ikon gembok/Setelan Situs browser, lalu coba lagi.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Izin mikrofon diblokir")) throw error;
  }

  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error: any) {
    const name = error?.name || "";
    const message = String(error?.message || "");

    if (name === "NotAllowedError" || name === "SecurityError" || /permission denied/i.test(message)) {
      throw new Error("Izin mikrofon ditolak. Tekan ikon gembok di address bar, pilih Microphone: Allow, lalu refresh halaman.");
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      throw new Error("Tidak ada mikrofon yang terdeteksi di perangkat ini.");
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      throw new Error("Mikrofon sedang dipakai aplikasi lain. Tutup aplikasi panggilan/rekaman lain lalu coba lagi.");
    }
    if (name === "OverconstrainedError") {
      throw new Error("Mikrofon tidak cocok dengan pengaturan browser saat ini.");
    }

    throw new Error(message || "Gagal mengakses mikrofon.");
  }
}