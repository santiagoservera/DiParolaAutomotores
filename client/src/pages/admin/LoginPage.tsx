import { Card, Button, Input } from '@/components/ui';
import { Logo } from '@/components/Logo';

interface LoginPageProps {
  onLogin: () => void;
  onBack: () => void;
}

export function LoginPage({ onLogin, onBack }: LoginPageProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implementar autenticación real con el backend
    onLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#004867] px-4">
      <Card className="w-full max-w-md p-10 space-y-10 border-none shadow-2xl">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <Logo className="h-28 w-28" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-[#004867] dark:text-[#4db8db]">
              Acceso Administrativo
            </h1>
            <p className="text-sm text-muted-foreground">Gestión interna Di Parola</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
              Usuario
            </label>
            <Input
              type="email"
              placeholder="usuario@diparola.com"
              className="bg-muted border-none h-12"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
              Contraseña
            </label>
            <Input
              type="password"
              placeholder="••••••••"
              className="bg-muted border-none h-12"
              required
            />
          </div>

          <Button type="submit" variant="primary" className="w-full h-12">
            Ingresar al sistema
          </Button>
        </form>

        <button
          onClick={onBack}
          className="w-full text-center text-xs text-muted-foreground hover:text-[#00adef] transition-colors"
        >
          Volver a la web pública
        </button>
      </Card>
    </div>
  );
}
