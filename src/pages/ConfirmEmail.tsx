import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, LogIn } from "lucide-react";

export default function ConfirmEmail() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.06),transparent_60%)]" />
      <Card className="w-full max-w-md relative z-10 border-border/60 text-center">
        <CardHeader>
          <div className="mx-auto mb-4 bg-primary/20 p-3 rounded-full w-16 h-16 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="font-display text-2xl">¡Email confirmado con éxito!</CardTitle>
          <CardDescription className="text-base mt-2">
            Tu cuenta ha sido verificada correctamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Ya puedes regresar a la aplicación para iniciar sesión y comenzar a usar MarketMaster.
          </p>
          <Button asChild className="w-full">
            <Link to="/login">
              <LogIn className="w-4 h-4 mr-2" />
              Ir al inicio de sesión
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
