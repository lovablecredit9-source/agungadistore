import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Lock } from "lucide-react";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Login gagal", description: error.message, variant: "destructive" });
    } else {
      navigate("/admin/dashboard");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Admin Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-3">
            <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button className="w-full" disabled={loading}>{loading ? "Loading..." : "Login"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;