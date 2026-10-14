import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Lock, KeyRound, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { hashPin, setAdminUnlocked } from "@/lib/adminSecurity";
import { supabase } from "@/lib/supabase";

interface AdminLockScreenProps {
  hasPinConfigured: boolean;
  storedPinHash?: string;
  onUnlock: () => void;
}

export default function AdminLockScreen({
  hasPinConfigured,
  storedPinHash,
  onUnlock,
}: AdminLockScreenProps) {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [settingPin, setSettingPin] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setErrorMsg("Ingresa tu PIN");
      return;
    }

    setVerifying(true);
    setErrorMsg("");

    try {
      const hashed = await hashPin(pin);
      if (storedPinHash && hashed === storedPinHash) {
        setAdminUnlocked(true);
        toast.success("Panel de Administrador desbloqueado");
        onUnlock();
      } else {
        setErrorMsg("PIN incorrecto. Acceso denegado.");
        toast.error("PIN incorrecto");
      }
    } catch (e: any) {
      setErrorMsg("Error al verificar: " + e.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleSetupPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPin.trim() || newPin.length < 4) {
      toast.error("El PIN debe tener al menos 4 dígitos");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("Los PINs no coinciden");
      return;
    }

    setSettingPin(true);
    try {
      const hashed = await hashPin(newPin);
      const { error } = await supabase.auth.updateUser({
        data: { admin_pin_hash: hashed },
      });

      if (error) throw error;

      setAdminUnlocked(true);
      toast.success("¡PIN de Administrador configurado con éxito!");
      onUnlock();
    } catch (e: any) {
      toast.error("Error al guardar el PIN: " + e.message);
    } finally {
      setSettingPin(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/60 shadow-xl bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
            {hasPinConfigured ? (
              <Lock className="h-7 w-7 text-primary animate-pulse" />
            ) : (
              <Shield className="h-7 w-7 text-primary" />
            )}
          </div>
          <CardTitle className="font-display text-xl">
            {hasPinConfigured ? "Panel de Administración Protegido" : "Configura tu PIN de Administrador"}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {hasPinConfigured
              ? "Ingresa tu PIN de seguridad para acceder a la gestión de usuarios, cupones y configuración."
              : "Protege este panel para que colaboradores o familiares con acceso a la app no puedan ver ni modificar datos administrativos."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {hasPinConfigured ? (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-pin">PIN de Seguridad</Label>
                <div className="relative">
                  <Input
                    id="admin-pin"
                    type={showPin ? "text" : "password"}
                    placeholder="••••"
                    maxLength={10}
                    value={pin}
                    autoFocus
                    onChange={(e) => {
                      setPin(e.target.value);
                      if (errorMsg) setErrorMsg("");
                    }}
                    className="text-center font-mono tracking-widest text-lg h-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errorMsg && (
                  <p className="text-xs text-destructive text-center font-medium mt-1">
                    {errorMsg}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full h-11" disabled={verifying}>
                {verifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" /> Desbloquear Panel
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSetupPin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-pin">Crea un PIN (4 a 6 dígitos)</Label>
                <Input
                  id="new-pin"
                  type="password"
                  placeholder="Ej: 4829"
                  maxLength={6}
                  value={newPin}
                  autoFocus
                  onChange={(e) => setNewPin(e.target.value)}
                  className="text-center font-mono tracking-widest text-lg h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-pin">Confirma tu PIN</Label>
                <Input
                  id="confirm-pin"
                  type="password"
                  placeholder="Repite el PIN"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="text-center font-mono tracking-widest text-lg h-12"
                />
              </div>

              <Button type="submit" className="w-full h-11" disabled={settingPin}>
                {settingPin ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando PIN...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" /> Guardar PIN y Acceder
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
