# Di Parola Automotores - Sistema de Gestión

## Reglas del Proyecto

- **IMPORTANTE**: Cada vez que se hagan cambios significativos en el sistema, actualizar este archivo CLAUDE.md para mantener el contexto al día.
- Idioma de la UI: Español (Argentina)
- Auto mode: el usuario prefiere ejecución autónoma con mínimas interrupciones
- Compilar siempre con `npx tsc --noEmit` antes de dar por terminado un cambio
- No agregar features no solicitadas, no refactorizar código que no se tocó

## Descripción

Sistema web para la gestión de ventas de vehículos por planes de ahorro/cuotas. Incluye sitio público (landing) y panel de administración con módulos de Ventas, Cobranzas, Recepción y Configuración.

## Estructura del Proyecto

```
DiParolaAutomotores/
├── client/                    # Frontend React + Vite + TypeScript
│   └── src/
│       ├── components/
│       │   ├── ui/            # shadcn/ui + componentes custom (Calendar, DatePicker)
│       │   ├── admin/         # AdminLayout, AdminDashboard
│       │   └── AdminSidebar.tsx  # Sidebar desktop + bottom tabs mobile
│       ├── context/           # AuthContext (JWT, permisos)
│       ├── lib/utils.ts       # Utilidades: currencyFormat, dateFormat, currencyInput, etc.
│       ├── pages/admin/       # Páginas del panel admin
│       ├── services/api.ts    # Axios services layer
│       └── types/             # TypeScript interfaces (ViewType, etc.)
├── server/                    # Backend Express + TypeScript
│   └── src/
│       ├── config/            # Cloudinary config
│       ├── middlewares/       # Auth JWT + Upload (Cloudinary/multer)
│       ├── routes/            # API routes (REST)
│       └── index.ts           # Server entry point
└── server/prisma/
    ├── schema.prisma          # SQL Server schema
    └── seed.ts                # Database seed
```

## Stack Tecnológico

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Axios, Sonner (toasts), Lucide icons, date-fns
- **Backend**: Express, TypeScript, Prisma ORM, Zod validation, JWT auth, Multer + Cloudinary, xlsx
- **Base de Datos**: SQL Server (Azure/local)
- **Routing Frontend**: Hash-based manual routing (NO React Router). Usa `window.location.hash` sincronizado con `currentView` state. Al refrescar, recupera la vista del hash o del token en localStorage.

## Módulos del Sistema

| Módulo | Permiso | Descripción |
|--------|---------|-------------|
| VENTAS | Contratos/Solicitudes de pedido de vehículos |
| COBRANZAS | Gestión de cuotas, pagos, seguimiento |
| RECEPCION | Contactos, visitas, citas agendadas |
| CONFIGURACION | Roles, usuarios, permisos |

## Componentes Custom Clave

### DatePicker (`components/ui/date-picker.tsx`)
- Popover con calendario visual custom (no usa el nativo del browser)
- 3 vistas: días → meses (tarjetas 3x4) → años (tarjetas 3x4 con paginación por flechas)
- Props: `value` (YYYY-MM-DD), `onChange`, `fromYear`, `toYear`, `error`, `placeholder`
- Dark theme integrado

### Calendar (`components/ui/calendar.tsx`)
- Calendario custom que NO depende de react-day-picker para el render (solo se importa el CSS base)
- Grid de 6 semanas, lunes como primer día
- Navegación: flechas para mes, click en header para selector de meses/años

### AdminSidebar (`components/AdminSidebar.tsx`)
- **Desktop (lg+)**: sidebar lateral clásico con logo, usuario, módulos, logout
- **Mobile (<lg)**: bottom tab bar con los primeros 4 módulos + menú "Más" para overflow

### Utilidades (`lib/utils.ts`)
- `currencyFormat(value)` → `$ 300.000` (ARS)
- `dateFormat(fecha)` → `20/06/2026`
- `currencyInput(value)` → formatea mientras se tipea (para inputs)
- `currencyRaw(value)` → extrae dígitos de string formateado

## Convenciones de Código

### Backend
- Cada route file crea su propio `new PrismaClient()`
- Auth: `authMiddleware` + `requirePermiso('MODULO', 'accion')`
- Validación con Zod schemas
- Respuestas paginadas: `{ data: [...], pagination: { total, page, limit, totalPages } }`
- Transacciones Prisma para operaciones multi-tabla
- Decimals: `new Prisma.Decimal(value)` para montos
- Soft delete para contratos (estado → CANCELADO), pero se puede reactivar
- PUT contratos acepta cambio de `estado` (ACTIVO/COMPLETADO/CANCELADO)

### Frontend
- No usar React Router - navegación via `currentView` state + hash sync
- Servicios API centralizados en `services/api.ts`
- Permisos via `useAuth().tienePermiso(modulo, accion)`
- UI: dark theme forzado en admin, colores base `#4a6fd4` (primary blue), `#0b0e18` (bg)
- Componentes shadcn/ui: Select, Input, Button, Card, Skeleton, Popover
- Pages manejan su propio detail/edit view con estado interno (`view: 'list' | 'detail' | 'edit'`)
- Búsqueda instantánea (onChange) sin botón, igual que Cobranzas
- Todos los montos usar `currencyFormat()` de `lib/utils.ts`
- Todos los dates usar `DatePicker` custom, NO `<input type="date">`
- Validaciones inline con errores por campo (borde rojo + mensaje debajo)
- DNI: solo dígitos, max 8 chars, validación live con contador
- Responsive: mobile-first, bottom tab bar en mobile, sidebar en desktop
- `pb-20` en AdminLayout para no tapar contenido con bottom tabs
- Scroll to top al cambiar de vista interna

## Flujo de Ventas (ContratosPage)

1. **Lista**: tabla desktop (md+) / cards mobile, búsqueda instantánea, filtro por estado, filtro por asesor (admin/verTodos), filtros fecha desde/hasta, paginación
2. **Detalle**: vista read-only con info del solicitante, contacto, venta, cónyuge, vehículo usado, cuotas (tabla desktop / cards mobile), archivos
3. **Edición**: vista full-page editable con todos los campos + selector de estado (Activo/Completado/Cancelado) + gestión de archivos (subir/eliminar/reemplazar). "Volver" va directo a la lista.
4. **Carga nueva**: wizard de 6 pasos con step indicator (compact en mobile, full en desktop), validaciones por paso, transiciones animadas

## Flujo de Cobranzas (CobranzasPage)

1. **Lista**: grid de cards con contratos agrupados, progreso de pago, filtros (estado, contrato, periodo, asesor para admin, fecha)
2. **Detalle**: cuotas con tabla, barra de progreso, stats, botones por cuota: pagar, editar, observaciones (log), comprobantes (upload), eliminar
3. **Agregar cuota**: modal para crear cuota nueva (monto + fecha vencimiento)
4. **Pagar cuota**: modal con forma de pago, fecha, observaciones → muestra comprobante visual + botón "Enviar por WhatsApp"
5. **Observaciones**: modal con log timestamped por cuota (ej: "llamé pero no atendió"), con fecha/hora automática y usuario
6. **Comprobantes**: modal para subir/ver/eliminar comprobantes de pago (imágenes en Cloudinary, carpeta `diparola/comprobantes`)

## API Endpoints

```
POST   /api/auth/login
GET    /api/auth/me
POST   /api/auth/cambiar-password

GET    /api/contratos                          (paginado, búsqueda, filtro estado/asesor/fecha)
GET    /api/contratos/asesores                 (lista distinta de asesores)
GET    /api/contratos/stats/como-llego         (stats agrupadas por comoLlego)
GET    /api/contratos/:id                      (incluye cuotas, archivos)
POST   /api/contratos                          (crea contrato + cuotas auto)
PUT    /api/contratos/:id                      (editar campos + cambiar estado)
DELETE /api/contratos/:id                      (soft delete → CANCELADO)
POST   /api/contratos/:id/archivos             (upload a Cloudinary)
DELETE /api/contratos/:id/archivos/:archivoId  (elimina de Cloudinary + DB)

GET    /api/cobranzas                          (listar cuotas, filtros + asesor)
GET    /api/cobranzas/contrato/:contratoId     (cuotas + resumen de un contrato)
POST   /api/cobranzas/contrato/:contratoId     (agregar cuota, permiso: editar)
PUT    /api/cobranzas/:cuotaId/pagar           (registrar pago, devuelve contrato info para recibo)
PUT    /api/cobranzas/:cuotaId                 (editar cuota)
DELETE /api/cobranzas/:cuotaId                 (eliminar cuota)
POST   /api/cobranzas/:cuotaId/observaciones   (agregar observación con timestamp)
GET    /api/cobranzas/:cuotaId/observaciones   (listar observaciones)
POST   /api/cobranzas/:cuotaId/comprobantes    (subir comprobante a Cloudinary)
GET    /api/cobranzas/:cuotaId/comprobantes    (listar comprobantes)
DELETE /api/cobranzas/:cuotaId/comprobantes/:id (eliminar comprobante)

POST   /api/recepcion/web                      (formulario público, sin auth)
GET    /api/recepcion/stats/como-llego         (stats por comoLlego)
GET    /api/recepcion
GET    /api/recepcion/citas
GET    /api/recepcion/:id
POST   /api/recepcion
PUT    /api/recepcion/:id
DELETE /api/recepcion/:id

GET    /api/configuracion/roles
POST   /api/configuracion/roles
PUT    /api/configuracion/roles/:id
DELETE /api/configuracion/roles/:id
PUT    /api/configuracion/roles/:id/permisos
GET    /api/configuracion/usuarios
POST   /api/configuracion/usuarios
PUT    /api/configuracion/usuarios/:id
DELETE /api/configuracion/usuarios/:id
GET    /api/configuracion/modulos

POST   /api/importar                           (importar Excel completo)
POST   /api/importar/preview                   (previsualizar sin importar)
```

## Importación de Excel

Endpoint `/api/importar` acepta archivos .xlsx con 2 hojas:
- **Carga de Clientes** → crea Contratos (mapeo: lugar venta, nro solicitud, asesor, nombre, DNI, domicilio, localidad, teléfonos, periodo pago, método pago, cuotas)
- **Cobranza** → crea/actualiza Cuotas con pagos por mes

Detección de duplicados por DNI. Preview antes de importar.

## Variables de Entorno

### Server (.env)
- `DATABASE_URL`, `SHADOW_DATABASE_URL` - SQL Server
- `JWT_SECRET` - Secret para tokens
- `FRONTEND_URL` - URL del frontend (CORS)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### Client (.env)
- `VITE_API_URL` - URL base del API (ej: http://localhost:3001/api)

## Comandos

```bash
cd server && npm run dev          # Backend desarrollo
cd server && npx prisma studio    # UI de la base de datos
cd server && npx prisma db push   # Aplicar schema
cd client && npm run dev          # Frontend desarrollo
cd client && npm run build        # Build producción
```

## Filtrado por Rol (Vendedor vs Admin vs verTodos)

- **Administrador** (CONFIGURACION.leer): ve todos los registros, puede editar todo
- **Vendedor**: solo ve y edita sus propios contratos y cuotas (filtro por `registradoPorId`)
- **Rol con verTodos**: ve todos los registros pero solo puede editar los propios. Se configura por módulo en Configuración > Roles & Permisos con el checkbox "Ver Todos"
- El filtro se aplica via `puedeVerTodos(req, modulo)` del auth middleware
- `req.userPermisos` contiene todos los permisos del rol con `verTodos` flag
- El admin check sigue siendo por CONFIGURACION.leer para compatibilidad

## Estado Actual (Julio 2026)

- **Ventas**: Completo (CRUD, wizard, edición, archivos, estado, responsive, filtro por vendedor/asesor/fecha, comoLlego con opciones actualizadas)
- **Cobranzas**: Completo (cards + tabla, paginación, agregar/editar/pagar cuotas, vencimiento automático, filtro por periodo/estado/asesor, observaciones por cuota con timestamp, comprobantes de pago con upload a Cloudinary, comprobante visual + envío por WhatsApp)
- **Recepción**: Completo (registro rápido, toggle cita, lista, calendario, tab de estadísticas "cómo llegó", campo comoLlego, endpoint público POST /api/recepcion/web para formulario del sitio, medio WEB)
- **Configuración**: Completo (CRUD usuarios, roles con permisos editables + checkbox "Ver Todos" por módulo)
- **Dashboard**: Stats + cuotas vencidas con detalle + últimos contratos + citas
- **Importar Excel**: Funcional con preview, crea 8 cuotas por cliente, respeta meses de cobranza
- **Responsive**: Bottom tab bar en mobile, todas las vistas adaptadas
