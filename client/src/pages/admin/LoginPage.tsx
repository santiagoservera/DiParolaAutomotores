import { useState } from 'react';
import { Input } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/context/AuthContext';
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface LoginPageProps {
  onSuccess: () => void;
  onBack: () => void;
}

export function LoginPage({ onSuccess, onBack }: LoginPageProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0b0e18] relative overflow-hidden">

      <style>{`
        @keyframes orbit { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes float-up { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes dash { to { stroke-dashoffset: -200; } }
        @keyframes pulse-ring { 0%,100% { transform: scale(1); opacity:0.15; } 50% { transform: scale(1.15); opacity:0.05; } }
        @keyframes gradient-x { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
      `}</style>

      {/* ── Left panel - decorative ───────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative items-center justify-center">

        {/* Animated concentric rings */}
        <div className="absolute inset-0 flex items-center justify-center">
          {[280, 220, 160].map((size, i) => (
            <div key={i} className="absolute rounded-full border border-[#4a6fd4]"
              style={{
                width: size, height: size,
                opacity: 0.06 + i * 0.03,
                animation: `orbit ${40 - i * 8}s linear infinite${i % 2 ? ' reverse' : ''}`,
              }}
            />
          ))}
        </div>

        {/* Floating particles */}
        {[
          { x: '20%', y: '25%', s: 3, d: 6 }, { x: '75%', y: '30%', s: 2, d: 8 },
          { x: '30%', y: '70%', s: 2.5, d: 7 }, { x: '65%', y: '75%', s: 2, d: 9 },
          { x: '50%', y: '20%', s: 1.5, d: 5 }, { x: '85%', y: '55%', s: 2, d: 10 },
          { x: '15%', y: '50%', s: 1.5, d: 7.5 },
        ].map((p, i) => (
          <div key={i} className="absolute rounded-full bg-[#4a6fd4]"
            style={{
              left: p.x, top: p.y, width: p.s, height: p.s,
              opacity: 0.25,
              animation: `float-up ${p.d}s ease-in-out infinite`,
              animationDelay: `${i * 0.7}s`,
            }}
          />
        ))}

        {/* Dashed orbit paths */}
        <svg className="absolute w-[500px] h-[500px] opacity-[0.06]" viewBox="0 0 500 500" fill="none">
          <circle cx="250" cy="250" r="200" stroke="#4a6fd4" strokeWidth="1" strokeDasharray="8 12">
            <animateTransform attributeName="transform" type="rotate" from="0 250 250" to="360 250 250" dur="60s" repeatCount="indefinite" />
          </circle>
          <circle cx="250" cy="250" r="150" stroke="#7b9ae8" strokeWidth="0.5" strokeDasharray="4 16">
            <animateTransform attributeName="transform" type="rotate" from="360 250 250" to="0 250 250" dur="45s" repeatCount="indefinite" />
          </circle>
        </svg>

        {/* Center content */}
        <div className="relative z-10 text-center px-12 animate-in fade-in duration-1000">
          <div className="inline-flex p-5 rounded-2xl bg-[#131729] border border-[#4a6fd4]/10 mb-8"
            style={{ animation: 'float-up 6s ease-in-out infinite' }}>
            <Logo className="h-20 w-20" src={true} />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Di Parola</h2>
          <p className="text-[#8892b0] text-sm max-w-xs mx-auto leading-relaxed">
            Sistema integral de gestión de ventas y cobranzas
          </p>

          {/* Animated line */}
          <svg className="mx-auto mt-8 w-48 h-1" viewBox="0 0 200 4">
            <line x1="0" y1="2" x2="200" y2="2" stroke="#4a6fd4" strokeWidth="2" strokeLinecap="round"
              strokeDasharray="40 160" style={{ animation: 'dash 4s linear infinite' }} />
          </svg>
        </div>

        {/* Corner accents */}
        <svg className="absolute top-8 left-8 w-16 h-16 opacity-[0.08]" viewBox="0 0 64 64" fill="none">
          <path d="M0 0 L24 0 L24 4 L4 4 L4 24 L0 24 Z" fill="#4a6fd4" />
        </svg>
        <svg className="absolute bottom-8 right-8 w-16 h-16 opacity-[0.08]" viewBox="0 0 64 64" fill="none">
          <path d="M64 64 L40 64 L40 60 L60 60 L60 40 L64 40 Z" fill="#4a6fd4" />
        </svg>
      </div>

      {/* ── Right panel - login form ──────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 sm:px-10 relative">

        {/* Subtle background accent for right panel */}
        <div className="absolute inset-0 bg-gradient-to-bl from-[#131729] to-[#0b0e18] lg:bg-gradient-to-l" />

        {/* Mobile: minimal top decoration */}
        <div className="lg:hidden absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#4a6fd4]/30 to-transparent" />

        <div className="relative w-full max-w-sm z-10 animate-in fade-in slide-in-from-right-4 duration-700">

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex p-3 rounded-xl bg-[#131729] border border-[#4a6fd4]/10 mb-4">
              <Logo className="h-14 w-14" src={true} />
            </div>
            <h1 className="text-xl font-bold text-white">Di Parola</h1>
            <p className="text-xs text-[#8892b0] mt-1">Sistema de Gestión</p>
          </div>

          {/* Welcome */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Bienvenido</h1>
            <p className="text-sm text-[#8892b0] mt-1">Ingresá tus credenciales para acceder</p>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#8892b0] uppercase tracking-[0.2em]">Email</label>
              <div className={`rounded-xl transition-all duration-300 ${focused === 'email' ? 'ring-2 ring-[#4a6fd4]/40' : ''}`}>
                <Input type="email" placeholder="usuario@diparola.com" value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                  className="bg-[#131729] border-[#4a6fd4]/10 h-12 text-white placeholder:text-[#8892b0]/40 focus:ring-0 focus:border-[#4a6fd4]/20 rounded-xl"
                  required disabled={loading} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#8892b0] uppercase tracking-[0.2em]">Contraseña</label>
              <div className={`relative rounded-xl transition-all duration-300 ${focused === 'pw' ? 'ring-2 ring-[#4a6fd4]/40' : ''}`}>
                <Input type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused('pw')} onBlur={() => setFocused(null)}
                  className="bg-[#131729] border-[#4a6fd4]/10 h-12 text-white placeholder:text-[#8892b0]/40 focus:ring-0 focus:border-[#4a6fd4]/20 pr-11 rounded-xl"
                  required disabled={loading} />
                <button type="button" onClick={() => setShowPw(!showPw)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8892b0]/40 hover:text-[#8892b0] transition-colors cursor-pointer p-1">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full h-12 rounded-xl text-white font-semibold shadow-lg shadow-[#2648a1]/20 hover:shadow-[#2648a1]/40 transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              style={{
                background: 'linear-gradient(135deg, #2648a1, #4a6fd4, #2648a1)',
                backgroundSize: '200% 200%',
                animation: loading ? undefined : 'gradient-x 6s ease infinite',
              }}>
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Ingresando...</>
              ) : (
                'Ingresar al sistema'
              )}
            </button>
          </form>

          <button onClick={onBack}
            className="w-full text-center text-xs text-[#8892b0]/40 hover:text-[#7b9ae8] transition-colors cursor-pointer mt-6">
            ← Volver a la web pública
          </button>
        </div>
      </div>
    </div>
  );
}
