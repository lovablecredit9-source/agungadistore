import { useState } from "react";
import { Edit2, LogOut, Plus, QrCode, ShieldAlert, Smartphone, Users } from "lucide-react";
import { ProfileActionGrid, ProfileSecurityHeader, SecuritySummaryCard, useSecuritySummary } from "./ProfileSecurityCenter";
import LoginActivityPanel from "./LoginActivityPanel";
import LogoutAllDialog from "./LogoutAllDialog";

type User = { visitor_id: string; username: string; email?: string | null; phone?: string | null };

export default function ProfileSecurityTop(props: {
  user: User;
  banned: boolean;
  savedCount: number;
  slotCap: number;
  canAddAccount: boolean;
  open: { edit: boolean; switcher: boolean; code: boolean; history: boolean };
  onToggleEdit: () => void;
  onToggleSwitcher: () => void;
  onToggleCode: () => void;
  onToggleHistory: (v?: boolean) => void;
  onAddAccount: () => void;
  onLogout: () => void;
  onLogoutAll: (revokeSupported: boolean) => Promise<void>;
  summaryRefreshKey?: number;
}) {
  const { user, banned, open } = props;
  const { summary, error, loading, reload } = useSecuritySummary(user.visitor_id, props.summaryRefreshKey);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-2.5">
      <ProfileSecurityHeader user={user} summary={summary} loading={loading} />
      <ProfileActionGrid actions={[
        { key: "edit", icon: Edit2, title: "Edit Profil", subtitle: "Kelola data & keamanan", onClick: props.onToggleEdit, disabled: banned, active: open.edit },
        { key: "switch", icon: Users, title: "Ganti Akun", subtitle: props.savedCount > 0 ? `${props.savedCount} dari ${props.slotCap} akun` : "Belum ada akun tersimpan", onClick: props.onToggleSwitcher, disabled: banned, active: open.switcher },
        { key: "add", icon: Plus, title: "Tambah Akun", subtitle: props.canAddAccount ? "Simpan akun lain" : "Slot akun penuh", onClick: props.onAddAccount, disabled: banned || !props.canAddAccount },
        { key: "logout", icon: LogOut, title: "Logout", subtitle: "Keluar dari akun ini", onClick: props.onLogout },
        { key: "logoutall", icon: ShieldAlert, title: "Logout Semua", subtitle: "Keluar dari semua perangkat", onClick: () => setLogoutAllOpen(true), tone: "danger" },
        { key: "history", icon: Smartphone, title: "Riwayat", subtitle: "Aktivitas login & perangkat", onClick: () => props.onToggleHistory(), disabled: banned, active: open.history },
        { key: "code", icon: QrCode, title: "Kode & Barcode Login", subtitle: "Login perangkat lain dengan kode sekali pakai", onClick: props.onToggleCode, disabled: banned, tone: "accent", active: open.code },
      ]} />
      {!open.history && (
        <SecuritySummaryCard summary={summary} error={error} loading={loading} onRetry={reload} onOpen={() => props.onToggleHistory(true)} />
      )}
      {open.history && !banned && <LoginActivityPanel key={user.visitor_id} visitorId={user.visitor_id} onClose={() => props.onToggleHistory(false)} />}

      <LogoutAllDialog
        open={logoutAllOpen}
        onOpenChange={setLogoutAllOpen}
        summary={summary}
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          try { await props.onLogoutAll(!!summary?.globalSignOutSupported); } finally { setBusy(false); setLogoutAllOpen(false); }
        }}
      />
    </div>
  );
}
