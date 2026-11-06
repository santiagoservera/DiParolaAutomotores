---
name: compile
description: Compila TypeScript del client y server para verificar errores
---

Ejecutar las dos compilaciones **en paralelo** usando el Bash tool:

1. `cd "E:\Programacion\Kodloop\DiParolaAutomotores\DiParolaAutomotores\client" && npx tsc --noEmit`
2. `cd "E:\Programacion\Kodloop\DiParolaAutomotores\DiParolaAutomotores\server" && npx tsc --noEmit`

Si ambas pasan sin errores, reportar: "Compilación OK (client + server)"

Si hay errores, listar cada error con archivo y línea, y sugerir el fix.
