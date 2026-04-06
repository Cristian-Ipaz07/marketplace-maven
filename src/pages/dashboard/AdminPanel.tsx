import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Loader2, Users, Ticket, Shield, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const planConfigs: Record<string, { daily_limit: number; price: number }> = {
  basico: { daily_limit: 15, price: 30000 },
  pro: { daily_limit: 40, price: 50000 },
  business: { daily_limit: 9999, price: 100000 },
};

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
  const { session } = useAuth();
  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<EnrichedUser | null>(null);
  const [editPlan, setEditPlan] = useState("basico");
  const [editExpires, setEditExpires] = useState("");
  const [editTrialEnds, setEditTrialEnds] = useState("");
  const [editIsTrial, setEditIsTrial] = useState(false);
  const [saving, setSaving] = useState(false);

  // Coupon form
  const [couponCode, setCouponCode] = useState("");
  const [couponPercent, setCouponPercent] = useState(0);
  const [couponAmount, setCouponAmount] = useState(0);
  const [couponMaxUses, setCouponMaxUses] = useState<number | "">("");
  const [couponExpires, setCouponExpires] = useState("");
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);

  useEffect(() => { loadData(); }, []);

  const callAdmin = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body,
    });
    if (error) throw error;
    return data;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 3 consultas planas en paralelo — sin joins, sin columnas inexistentes
      const [profilesResult, subsResult, rolesResult, couponResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url, created_at"),
        supabase
          .from("subscriptions")
          .select("id, user_id, plan, daily_limit, price, is_trial, trial_ends_at, expires_at, active, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("user_roles")
          .select("user_id, role"),
        supabase
          .from("coupons")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (profilesResult.error) throw new Error("Perfiles: " + profilesResult.error.message);

      // Mapa user_id → suscripción activa (o la más reciente)
      const subsMap: Record<string, any> = {};
      for (const sub of subsResult.data || []) {
        if (!subsMap[sub.user_id] || sub.active) subsMap[sub.user_id] = sub;
      }

      // Mapa user_id → roles[]
      const rolesMap: Record<string, string[]> = {};
      for (const r of rolesResult.data || []) {
        if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
        rolesMap[r.user_id].push(r.role);
      }

      // display_name en el trigger se setea como el email del usuario
      const enriched: EnrichedUser[] = (profilesResult.data || []).map((p: any) => ({
        id: p.user_id,
        email: p.display_name || "Sin identificador",
        created_at: p.created_at,
        profile: { display_name: p.display_name },
        subscription: subsMap[p.user_id] || null,
        roles: rolesMap[p.user_id] || [],
      }));

      setUsers(enriched);
      setCoupons((couponResult.data || []) as Coupon[]);
    } catch (e: any) {
      toast.error("Error al cargar datos: " + e.message);
    }
    setLoading(false);
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
      const config = planConfigs[editPlan];
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
        // Actualizar suscripción existente
        const { error } = await supabase
          .from("subscriptions")
          .update(updates)
          .eq("id", editUser.subscription.id);
        if (error) throw new Error(error.message);
      } else {
        // Crear suscripción nueva
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

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const trialUsers = users.filter((u) => u.subscription?.is_trial);
  const paidUsers = users.filter((u) => u.subscription && !u.subscription.is_trial);

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> Panel de Administración
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gestiona usuarios, planes y cupones</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" /> Usuarios ({users.length})</TabsTrigger>
          <TabsTrigger value="coupons" className="gap-2"><Ticket className="h-4 w-4" /> Cupones ({coupons.length})</TabsTrigger>
        </TabsList>

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
                <p className="text-2xl font-bold text-accent">{paidUsers.length}</p>
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
                    const expired = sub?.expires_at ? new Date(sub.expires_at) < new Date() : false;
                    const trialExpired = sub?.is_trial && sub?.trial_ends_at ? new Date(sub.trial_ends_at) < new Date() : false;
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <p className="font-medium text-sm text-foreground">{u.profile?.display_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">{sub?.plan || "sin plan"}</Badge>
                        </TableCell>
                        <TableCell>
                          {sub?.is_trial ? (
                            <Badge variant={trialExpired ? "destructive" : "outline"}>
                              {trialExpired ? "Trial vencido" : "En prueba"}
                            </Badge>
                          ) : expired ? (
                            <Badge variant="destructive">Vencido</Badge>
                          ) : (
                            <Badge variant="default">Activo</Badge>
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

          {/* Edit User Dialog */}
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
                      <SelectItem value="basico">Básico ($30.000)</SelectItem>
                      <SelectItem value="pro">Pro ($50.000)</SelectItem>
                      <SelectItem value="business">Business ($100.000)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editIsTrial} onChange={(e) => setEditIsTrial(e.target.checked)} className="rounded" />
                    Es prueba gratuita
                  </label>
                </div>
                {editIsTrial && (
                  <div>
                    <Label>Fin de prueba</Label>
                    <Input type="date" value={editTrialEnds} onChange={(e) => setEditTrialEnds(e.target.value)} />
                  </div>
                )}
                <div>
                  <Label>Fecha de vencimiento</Label>
                  <Input type="date" value={editExpires} onChange={(e) => setEditExpires(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Dejar vacío para sin vencimiento</p>
                </div>
                <Button onClick={saveUserPlan} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Guardar cambios
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="coupons">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">Cupones de descuento para suscripciones</p>
            <Dialog open={couponDialogOpen} onOpenChange={setCouponDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Crear cupón</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nuevo cupón</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Código</Label>
                    <Input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="DESCUENTO20" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>% Descuento</Label>
                      <Input type="number" value={couponPercent} onChange={(e) => setCouponPercent(Number(e.target.value))} min={0} max={100} />
                    </div>
                    <div>
                      <Label>$ Descuento fijo</Label>
                      <Input type="number" value={couponAmount} onChange={(e) => setCouponAmount(Number(e.target.value))} min={0} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Usos máximos</Label>
                      <Input type="number" value={couponMaxUses} onChange={(e) => setCouponMaxUses(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Ilimitado" />
                    </div>
                    <div>
                      <Label>Vence</Label>
                      <Input type="date" value={couponExpires} onChange={(e) => setCouponExpires(e.target.value)} />
                    </div>
                  </div>
                  <Button onClick={createCoupon} className="w-full">Crear cupón</Button>
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
      </Tabs>
    </div>
  );
}
