import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const Offline = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-sm">
        <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <WifiOff className="w-10 h-10 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Kamu Sedang Offline</h1>
          <p className="text-muted-foreground">
            Tidak ada koneksi internet. Beberapa fitur mungkin tidak tersedia, tapi kamu masih bisa menikmati lagu yang sudah di-cache sebelumnya.
          </p>
        </div>
        <Button
          onClick={() => window.location.href = "/"}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Coba Lagi
        </Button>
      </div>
    </div>
  );
};

export default Offline;
