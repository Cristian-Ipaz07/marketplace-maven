import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Mail, ArrowLeft } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Ingresa tu email"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
    toast.success("¡Revisa tu correo!");
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.06),transparent_60%)]" />
        <Card className="w-full max-w-md relative z-10 border-border/60 text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="font-display text-xl">¡Revisa tu correo!</CardTitle>
            <CardDescription>
              Hemos enviado un enlace de acceso a <strong>{email}</strong>. 
              Haz clic en el enlace para iniciar sesión.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">¿No lo ves? Revisa tu carpeta de spam.</p>
            <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Intentar con otro correo
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.06),transparent_60%)]" />
      <Card className="w-full max-w-md relative z-10 border-border/60">
        <CardHeader className="text-center">
          <Link to="/" className="font-display text-2xl font-bold text-foreground tracking-tight mb-2 block">
            Market<span className="text-primary">Master</span>
          </Link>
          <CardTitle className="font-display text-xl">Iniciar sesión</CardTitle>
          <CardDescription>Te enviaremos un enlace de acceso a tu correo</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              <Mail className="w-4 h-4 mr-2" />
              {loading ? "Enviando..." : "Enviar enlace de acceso"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-6">
            ¿No tienes cuenta? <Link to="/register" className="text-primary hover:underline font-medium">Regístrate</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
