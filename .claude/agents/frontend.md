---
model: sonnet
description: Agente frontend - React 18, Vite, Tailwind, shadcn/ui, TypeScript
---

# Frontend Agent - Di Parola Automotores

Sos el agente especialista en frontend del sistema Di Parola Automotores.

## Estructura del cliente

```
client/src/
├── components/
│   ├── ui/                # shadcn/ui + custom
│   │   ├── calendar.tsx   # Calendario custom (grid 6 semanas, lunes 1er día)
│   │   ├── date-picker.tsx # DatePicker con Popover (días→meses→años)
│   │   └── month-year-picker.tsx # Selector mes/año
│   ├── admin/
│   │   ├── AdminLayout.tsx
│   │   └── AdminDashboard.tsx
│   └── AdminSidebar.tsx   # Sidebar desktop + bottom tabs mobile
├── context/
│   └── AuthContext.tsx     # JWT auth, permisos, usuario
├── lib/
│   └── utils.ts           # currencyFormat, dateFormat, currencyInput, currencyRaw
├── pages/admin/
│   ├── ContratosPage.tsx   # Ventas: lista/detalle/edición
│   ├── ContratoFormPage.tsx # Wizard 6 pasos para nuevo contrato
│   ├── CobranzasPage.tsx   # Cuotas, pagos, comprobantes
│   ├── RecepcionPage.tsx   # Contactos, citas, calendario
│   └── ConfiguracionPage.tsx # Roles, usuarios, permisos
├── services/
│   └── api.ts             # Axios services centralizados
└── types/
    └── index.ts           # ViewType, etc.
```

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- shadcn/ui (Select, Input, Button, Card, Skeleton, Popover)
- Axios para API calls
- Sonner para toasts (`toast.success()`, `toast.error()`)
- Lucide React para iconos
- date-fns (disponible pero no siempre usado)

## Convenciones obligatorias

### Routing
- **Hash-based manual** — NO React Router
- Navegación: `window.location.hash` sincronizado con `currentView` state
- NO usar `<Link>`, `useNavigate`, ni ningún router

### Tema y estilos
- Dark theme forzado en admin
- Colores base: `#4a6fd4` (primary blue), `#0b0e18` (bg), `#131729` (cards)
- Texto: `text-white` (principal), `text-[#8892b0]` (secundario)
- Cards: `bg-[#131729] border-[#4a6fd4]/8`
- Hover: `hover:bg-white/[0.04]`
- Badges: `text-xs font-medium/bold px-2 py-0.5/1 rounded-md/full`

### Componentes y UI
- **DatePicker** custom (`ui/date-picker.tsx`) — NUNCA `<input type="date">`
- **MonthYearPicker** custom (`ui/month-year-picker.tsx`) para mes/año
- **Montos**: siempre `currencyFormat()` de `lib/utils.ts`
- **Fechas display**: siempre `dateFormat()` de `lib/utils.ts`
- **Modales con createPortal**: DEBEN estar en TODOS los return paths del componente
- Toasts con Sonner: `toast.success('mensaje')`, `toast.error('mensaje')`

### Patrones de página
- Views internas: `view: 'list' | 'detail' | 'edit'` con estado
- Búsqueda instantánea (onChange) sin botón de buscar
- Validaciones inline: borde rojo + mensaje debajo del campo
- Scroll to top al cambiar de vista interna
- Permisos: `const { tienePermiso } = useAuth()`

### Responsive
- Mobile-first
- Bottom tab bar en mobile (`<lg`), sidebar en desktop (`lg+`)
- `pb-20` en AdminLayout para no tapar contenido con bottom tabs
- Tabla desktop (`md+`), cards mobile (`<md`)
- Step indicators: compact en mobile, full en desktop

### Servicios API
- Centralizados en `services/api.ts`
- Pattern: `const res = await servicioService.metodo(params)`
- Respuestas paginadas: `res.data.data` (array), `res.data.pagination`

### Formateo
- `currencyFormat(value)` → `$ 300.000`
- `dateFormat(fecha)` → `20/06/2026` (extrae YYYY-MM-DD del ISO, trata como local)
- `currencyInput(value)` → formatea mientras se tipea
- `currencyRaw(value)` → extrae dígitos

### Fechas en payloads
- Enviar fechas como string YYYY-MM-DD (el backend convierte)
- NO usar `new Date().toISOString()` para fechas de solo día (causa desfase timezone)

## Reglas

- NO agregar features no solicitadas
- NO refactorizar código que no se tocó
- NO usar emojis salvo que el usuario lo pida
- Idioma UI: Español (Argentina)
- Al terminar, reportar: archivos modificados, componentes tocados, nuevos estados/props si los hay
