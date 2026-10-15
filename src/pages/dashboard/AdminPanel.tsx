import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { 
  Loader2, Users, Ticket, Shield, Pencil, Plus, Trash2, 
  Lock, KeyRound, Eye, EyeOff, Laptop, CheckCircle2, AlertTriangle 
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { PLAN_LIMITS } from "@/lib/plans";
import AdminLockScreen from "@/components/AdminLockScreen";
import { 
  isAdminUnlocked, 
  setAdminUnlocked, 
  hashPin, 
  isHideAdminInSidebar, 
  setHideAdminInSidebar 
} from "@/lib/adminSecurity";

interface EnrichedUser {
  id: string;
  email: string;
  created_at: string;
  profile: { display_name: string | null } | null;
  subscription: {
    id: string;
    plan: string;
    daily_limit: number;
    price: number;
    is_trial: boolean;
    trial_ends_at: string | null;
    expires_at: string | null;
  } | null;
  roles: string[];
}

interface Coupon {
  id: string;
  code: string;
  discount_percent: number;
  discount_amount: number;
  max_uses: number | null;
  current_uses: number;
  active: boolean;
  expires_at: string | null;
}

export default function AdminPanel() {
  const { session, user } = useAuth();
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked());
  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<EnrichedUser | null>(null);
  const [editPlan, setEditPlan] = useState("basico");
  const [editExpires, setEditExpires] = useState("");
  const [editTrialEnds, setEditTrialEnds] = useState("");
  const [editIsTrial, setEditIsTrial] = useState(false);
  const [saving, setSaving] = useState(false);

  // Formulario de Cupones
  const [couponCode, setCouponCode] = useState("");
  const [couponPercent, setCouponPercent] = useState(0);
  const [couponAmount, setCouponAmount] = useState(0);
  const [couponMaxUses, setCouponMaxUses] = useState<number | "">("");
  const [couponExpires, setCouponExpires] = useState("");
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);

  // Formulario de Cambio de Contraseña
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Formulario de Cambio de PIN
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [updatingPin, setUpdatingPin] = useState(false);

  // Visibilidad en este dispositivo
  const [hiddenInSidebar, setHiddenInSidebarState] = useState(() => isHideAdminInSidebar());

  const hasPinConfigured = Boolean(user?.user_metadata?.admin_pin_hash);
  const storedPinHash = user?.user_metadata?.admin_pin_hash;

  useEffect(() => {
    if (unlocked) {
      loadData();
    }
  }, [unlocked]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Intentar obtener la lista de usuarios vía RPC get_admin_users (lectura directa y segura de auth.users)
      const [rpcResult, couponResult] = await Promise.all([
        supabase.rpc("get_admin_users"),
        supabase.from("coupons").select("*").order("created_at", { ascending: false }),
      ]);

      if (!rpcResult.error && Array.isArray(rpcResult.data) && rpcResult.data.length > 0) {
        setUsers(rpcResult.data as EnrichedUser[]);
        setCoupons((couponResult.data || []) as Coupon[]);
        setLoading(false);
        return;
      }

      // 2. Fallback resiliente si la función RPC aún no ha sido creada en Supabase
      const [profilesResult, subsResult, rolesResult] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url, created_at"),
        supabase.from("subscriptions").select("id, user_id, plan, daily_limit, price, is_trial, trial_ends_at, expires_at, active, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      const profilesMap: Record<string, any> = {};
      for (const p of profilesResult.data || []) {
        profilesMap[p.user_id] = p;
      }

      const subsMap: Record<string, any> = {};
      for (const sub of subsResult.data || []) {
        if (!subsMap[sub.user_id] || sub.active) subsMap[sub.user_id] = sub;
      }

      const rolesMap: Record<string, string[]> = {};
      for (const r of rolesResult.data || []) {
        if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
        rolesMap[r.user_id].push(r.role);
      }

      // Combinar todos los user_ids detectados para incluir a cualquier usuario nuevo
      const allUserIds = Array.from(new Set([
        ...Object.keys(profilesMap),
        ...Object.keys(subsMap),
        ...Object.keys(rolesMap),
      ]));

      const enriched: EnrichedUser[] = allUserIds.map((uid) => {
        const p = profilesMap[uid];
        const s = subsMap[uid];
        return {
          id: uid,
          email: p?.display_name || (s ? `Usuario registrado (${uid.slice(0, 8)})` : "Usuario registrado"),
          created_at: p?.created_at || s?.created_at || new Date().toISOString(),
          profile: p ? { display_name: p.display_name } : null,
          subscription: s || null,
          roles: rolesMap[uid] || ["user"],
        };
      });

      setUsers(enriched);
      setCoupons((couponResult.data || []) as Coupon[]);
    } catch (e: any) {
      toast.error("Error al cargar datos: " + e.message);
    }
    setLoading(false);
  };

  const handleLockPanel = () => {
    setAdminUnlocked(false);
    setUnlocked(false);
    toast.info("Panel de Administración bloqueado");
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success("¡Contraseña de la cuenta actualizada exitosamente!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast.error("Error al actualizar contraseña: " + e.message);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasPinConfigured) {
      const hashedCurrent = await hashPin(currentPin);
      if (hashedCurrent !== storedPinHash) {
        toast.error("El PIN actual es incorrecto");
        return;
      }
    }

    if (!newPin || newPin.length < 4) {
      toast.error("El nuevo PIN debe tener al menos 4 dígitos");
      return;
    }
    if (newPin !== confirmNewPin) {
      toast.error("Los nuevos PINs no coinciden");
      return;
    }

    setUpdatingPin(true);
    try {
      const hashed = await hashPin(newPin);
      const { error } = await supabase.auth.updateUser({
        data: { admin_pin_hash: hashed },
      });
      if (error) throw error;

      toast.success("¡PIN de Administrador actualizado con éxito!");
      setCurrentPin("");
      setNewPin("");
      setConfirmNewPin("");
    } catch (e: any) {
      toast.error("Error al actualizar PIN: " + e.message);
    } finally {
      setUpdatingPin(false);
    }
  };

  const handleToggleHideSidebar = () => {
    const nextState = !hiddenInSidebar;
    setHideAdminInSidebar(nextState);
    setHiddenInSidebarState(nextState);
    if (nextState) {
      toast.info("Botón Admin oculto en este navegador. Haz 5 clics en el logo para mostrarlo.");
    } else {
      toast.success("Botón Admin visible en este navegador.");
    }
  };

  const openEditDialog = (u: EnrichedUser) => {
    setEditUser(u);
    setEditPlan(u.subscription?.plan || "basico");
    setEditExpires(u.subscription?.expires_at ? u.subscription.expires_at.split("T")[0] : "");
    setEditTrialEnds(u.subscription?.trial_ends_at ? u.subscription.trial_ends_at.split("T")[0] : "");
    setEditIsTrial(u.subscription?.is_trial || false);
  };

  const saveUserPlan = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const config = PLAN_LIMITS[editPlan] || PLAN_LIMITS.basico;
      const updates = {
        plan: editPlan,
        daily_limit: config.daily_limit,
        price: config.price,
        is_trial: editIsTrial,
        trial_ends_at: editTrialEnds ? new Date(editTrialEnds).toISOString() : null,
        expires_at: editExpires ? new Date(editExpires).toISOString() : null,
        active: true,
        updated_at: new Date().toISOString(),
      };

      if (editUser.subscription?.id) {
        const { error } = await supabase
          .from("subscriptions")
          .update(updates)
          .eq("id", editUser.subscription.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("subscriptions")
          .insert({ ...updates, user_id: editUser.id });
        if (error) throw new Error(error.message);
      }

      toast.success("Plan actualizado");
      setEditUser(null);
      loadData();
    } catch (e: any) {
      toast.error("Error al guardar: " + e.message);
    }
    setSaving(false);
  };

  const toggleAdmin = async (u: EnrichedUser) => {
    const isAdmin = u.roles.includes("admin");
    try {
      if (isAdmin) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", u.id)
          .eq("role", "admin");
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("user_roles")
          .upsert({ user_id: u.id, role: "admin" }, { onConflict: "user_id,role" });
        if (error) throw new Error(error.message);
      }
      toast.success(isAdmin ? "Admin removido" : "Admin asignado");
      loadData();
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const createCoupon = async () => {
    if (!couponCode.trim()) { toast.error("Código requerido"); return; }
    const { error } = await supabase.from("coupons").insert({
      code: couponCode.trim().toUpperCase(),
      discount_percent: couponPercent,
      discount_amount: couponAmount,
      max_uses: couponMaxUses === "" ? null : couponMaxUses,
      expires_at: couponExpires ? new Date(couponExpires).toISOString() : null,
    });
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success("Cupón creado");
    setCouponDialogOpen(false);
    setCouponCode("");
    setCouponPercent(0);
    setCouponAmount(0);
    setCouponMaxUses("");
    setCouponExpires("");
    loadData();
  };

  const deleteCoupon = async (id: string) => {
    await supabase.from("coupons").delete().eq("id", id);
    toast.success("Cupón eliminado");
    loadData();
  };

  const toggleCouponActive = async (c: Coupon) => {
    await supabase.from("coupons").update({ active: !c.active }).eq("id", c.id);
    loadData();
  };

  // Si está bloqueado, mostrar la pantalla de bloqueo con PIN
  if (!unlocked) {
    return (
      <AdminLockScreen
        hasPinConfigured={hasPinConfigured}
        storedPinHash={storedPinHash}
        onUnlock={() => {
          setUnlocked(true);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const trialUsers = users.filter((u) => u.subscription?.is_trial);
  const paidUsers = users.filter((u) => u.subscription && !u.subscription.is_trial);

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Panel de Administración
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestiona usuarios, suscripciones, cupones y credenciales de seguridad
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLockPanel}
            className="text-muted-foreground hover:text-foreground border-border/80"
          >
            <Lock className="h-4 w-4 mr-1.5" /> Bloquear Panel
          </Button>
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-6">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" /> Usuarios ({users.length})
          </TabsTrigger>
          <TabsTrigger value="coupons" className="gap-2">
            <Ticket className="h-4 w-4" /> Cupones ({coupons.length})
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <KeyRound className="h-4 w-4" /> Seguridad & Credenciales
          </TabsTrigger>
        </TabsList>

        {/* ================= PESTAÑA: USUARIOS ================= */}
        <TabsContent value="users">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="border-border/60">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{users.length}</p>
                <p className="text-xs text-muted-foreground">Total usuarios</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{trialUsers.length}</p>
                <p className="text-xs text-muted-foreground">En prueba</p>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-500">{paidUsers.length}</p>
                <p className="text-xs text-muted-foreground">Con plan pago</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const sub = u.subscription;
                    const planName = sub?.plan ? sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1) : "Básico";
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-foreground">{u.profile?.display_name || u.email}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">{planName}</Badge>
                        </TableCell>
                        <TableCell>
                          {sub?.is_trial ? (
                            <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">En prueba</Badge>
                          ) : sub?.expires_at ? (
                            <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">Activo</Badge>
                          ) : (
                            <Badge variant="secondary">—</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {sub?.is_trial && sub?.trial_ends_at
                            ? new Date(sub.trial_ends_at).toLocaleDateString()
                            : sub?.expires_at
                            ? new Date(sub.expires_at).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {u.roles.includes("admin") ? (
                            <Badge className="bg-primary/20 text-primary">Admin</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">User</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditDialog(u)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toggleAdmin(u)}>
                            <Shield className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Dialogo para Editar Usuario */}
          <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar suscripción — {editUser?.email}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Plan</Label>
                  <Select value={editPlan} onValueChange={setEditPlan}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basico">Básico ($29.000/mes — 10 pubs/día)</SelectItem>
                      <SelectItem value="pro">Pro ($49.000/mes — 25 pubs/día)</SelectItem>
                      <SelectItem value="business">Business ($89.000/mes — 60 pubs/día)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Vencimiento de prueba</Label>
                  <Input type="date" value={editTrialEnds} onChange={(e) => setEditTrialEnds(e.target.value)} />
                </div>
                <div>
                  <Label>Vencimiento de plan</Label>
                  <Input type="date" value={editExpires} onChange={(e) => setEditExpires(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_trial"
                    checked={editIsTrial}
                    onChange={(e) => setEditIsTrial(e.target.checked)}
                    className="rounded border-border"
                  />
                  <Label htmlFor="is_trial" className="cursor-pointer">¿Está en periodo de prueba?</Label>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
                  <Button onClick={saveUserPlan} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ================= PESTAÑA: CUPONES ================= */}
        <TabsContent value="coupons">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">Crea códigos de descuento para promociones o pruebas</p>
            <Dialog open={couponDialogOpen} onOpenChange={setCouponDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nuevo cupón</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear nuevo cupón</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Código</Label>
                    <Input
                      placeholder="EJ: PROMO50"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="font-mono uppercase"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Descuento %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={couponPercent}
                        onChange={(e) => setCouponPercent(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label>Descuento $ COP</Label>
                      <Input
                        type="number"
                        min={0}
                        value={couponAmount}
                        onChange={(e) => setCouponAmount(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Límite de usos (vacío = ilimitado)</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Ilimitado"
                      value={couponMaxUses}
                      onChange={(e) => setCouponMaxUses(e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Fecha de expiración (vacío = sin vencimiento)</Label>
                    <Input type="date" value={couponExpires} onChange={(e) => setCouponExpires(e.target.value)} />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setCouponDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={createCoupon}>Crear cupón</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="border-border/60">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descuento</TableHead>
                    <TableHead>Usos</TableHead>
                    <TableHead>Vence</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-bold text-foreground">{c.code}</TableCell>
                      <TableCell className="text-sm">
                        {c.discount_percent > 0 && `${c.discount_percent}%`}
                        {c.discount_percent > 0 && c.discount_amount > 0 && " + "}
                        {c.discount_amount > 0 && `$${c.discount_amount.toLocaleString()}`}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.current_uses}/{c.max_uses ?? "∞"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={c.active ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleCouponActive(c)}>
                          {c.active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => deleteCoupon(c.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {coupons.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay cupones creados</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= PESTAÑA: SEGURIDAD & CREDENCIALES ================= */}
        <TabsContent value="security" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Tarjeta 1: Cambiar Contraseña de la Cuenta */}
            <Card className="border-border/60">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Contraseña de MarketMaster</CardTitle>
                </div>
                <CardDescription>
                  Cambia la contraseña de acceso a esta cuenta. Esto protegerá tu cuenta personal ya que NO afectará tu contraseña de Gmail ni de Google.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Cuenta actual: {user?.email}
                    </p>
                    <p>La nueva clave será la que compartas con el equipo si todos usan esta misma cuenta.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-new-pass">Nueva Contraseña</Label>
                    <div className="relative">
                      <Input
                        id="admin-new-pass"
                        type={showPassword ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-confirm-pass">Confirmar Nueva Contraseña</Label>
                    <Input
                      id="admin-confirm-pass"
                      type={showPassword ? "text" : "password"}
                      placeholder="Repite la nueva contraseña"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>

                  <Button type="submit" disabled={updatingPassword} className="w-full">
                    {updatingPassword ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando Contraseña...
                      </>
                    ) : (
                      "Actualizar Contraseña de Cuenta"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Tarjeta 2: Cambiar PIN de Administrador */}
            <Card className="border-border/60">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">PIN del Panel de Administrador</CardTitle>
                </div>
                <CardDescription>
                  El PIN bloquea este panel en cualquier computador para que los empleados o colaboradores que usen la cuenta no puedan ingresar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdatePin} className="space-y-4">
                  {hasPinConfigured && (
                    <div className="space-y-2">
                      <Label htmlFor="admin-cur-pin">PIN Actual</Label>
                      <Input
                        id="admin-cur-pin"
                        type="password"
                        placeholder="••••"
                        maxLength={10}
                        value={currentPin}
                        onChange={(e) => setCurrentPin(e.target.value)}
                        className="font-mono tracking-widest text-center"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="admin-new-pin">Nuevo PIN (4 a 6 dígitos)</Label>
                    <Input
                      id="admin-new-pin"
                      type="password"
                      placeholder="Ej: 4829"
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      className="font-mono tracking-widest text-center"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-confirm-pin">Confirmar Nuevo PIN</Label>
                    <Input
                      id="admin-confirm-pin"
                      type="password"
                      placeholder="Repite el nuevo PIN"
                      maxLength={6}
                      value={confirmNewPin}
                      onChange={(e) => setConfirmNewPin(e.target.value)}
                      className="font-mono tracking-widest text-center"
                    />
                  </div>

                  <Button type="submit" disabled={updatingPin} className="w-full">
                    {updatingPin ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando PIN...
                      </>
                    ) : (
                      "Actualizar PIN de Seguridad"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

          </div>

          {/* Tarjeta 3: Ocultar botón Admin en este dispositivo */}
          <Card className="border-border/60">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Laptop className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Visibilidad en este Navegador / Computador</CardTitle>
              </div>
              <CardDescription>
                Ideal para cuando estés configurando el computador de un empleado o colaborador.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-card border border-border/80">
                <div className="space-y-1">
                  <p className="font-medium text-sm text-foreground">
                    Ocultar botón "Admin" de la barra lateral en este navegador
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Estado actual:{" "}
                    {hiddenInSidebar ? (
                      <span className="text-amber-500 font-semibold">Oculto (Nadie lo ve en la barra)</span>
                    ) : (
                      <span className="text-emerald-500 font-semibold">Visible en la barra</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground pt-1">
                    💡 Si lo ocultas, tú siempre puedes volver a abrirlo en esta computadora haciendo{" "}
                    <strong className="text-foreground">5 clics rápidos</strong> sobre el logo de MarketMaster en la barra lateral.
                  </p>
                </div>
                <Button
                  type="button"
                  variant={hiddenInSidebar ? "default" : "outline"}
                  onClick={handleToggleHideSidebar}
                  className="shrink-0"
                >
                  {hiddenInSidebar ? "Mostrar botón Admin" : "Ocultar botón Admin"}
                </Button>
              </div>
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
    </div>
  );
}
