---
name: audit
description: Auditoría de cambios recientes - bugs, edge cases, types, seguridad
---

Realizar una auditoría de los cambios recientes del proyecto. Usar `git diff` para identificar qué cambió.

## Qué revisar

### 1. Type safety
- Campos en interfaces TypeScript que no matchean con el backend
- Campos opcionales usados sin null check
- Props faltantes en componentes

### 2. Edge cases
- Valores null/undefined no manejados
- Arrays vacíos que causan errores en .map/.reduce
- Divisiones por cero en cálculos de montos
- Strings vacíos que deberían ser null en la DB

### 3. Consistencia backend ↔ frontend
- Campos que el backend devuelve pero el frontend no consume
- Campos que el frontend envía pero el backend no procesa
- Formatos de respuesta inconsistentes

### 4. UX
- Modales sin guard de doble-click (disabled durante loading)
- Botones sin estado loading durante operaciones async
- Estados imposibles (ej: COMPLETADO → COMPLETADO de nuevo)
- Formularios que permiten enviar con datos inválidos

### 5. Seguridad
- Endpoints sin authMiddleware
- Permisos no verificados en frontend Y backend
- Datos sensibles expuestos en respuestas

## Output

Para cada hallazgo reportar:
- **Archivo**: path + línea
- **Severidad**: ALTA / MEDIA / BAJA
- **Problema**: qué puede salir mal
- **Fix**: cambio sugerido (código concreto)

Usar agentes `backend` y `frontend` en paralelo para dividir la auditoría si el alcance es grande.
