---
name: deploy
description: Guía de deploy a producción (DonWeb VPS)
---

## Deploy automático (lo normal)

Push a `main` dispara GitHub Actions (`.github/workflows/deploy.yml`):
1. Build frontend (`npm run build` en client)
2. SCP: backend source + prisma + dist al servidor
3. `npx prisma generate` en el servidor
4. `pm2 restart diparola`

```bash
git push origin main
```

## Si hubo cambios en schema.prisma

El deploy automático **NO** ejecuta `prisma db push`. Hacerlo manual por SSH:

```bash
ssh -p 5579 root@149.50.157.62
cd /var/www/diparola
npx prisma db push
pm2 restart diparola
```

## Si hubo nuevas dependencias (npm install)

```bash
ssh -p 5579 root@149.50.157.62
cd /var/www/diparola
npm install <paquete>
pm2 restart diparola
```

## Verificar que funciona

```bash
ssh -p 5579 root@149.50.157.62
pm2 logs diparola --lines 10
```

## Rollback (si algo sale mal)

```bash
ssh -p 5579 root@149.50.157.62
cd /var/www/diparola
git log --oneline -5          # ver commits recientes
git checkout <commit-hash>    # volver a versión anterior
npx prisma generate
pm2 restart diparola
```

## Datos útiles

- **Server**: DonWeb VPS 149.50.157.62, SSH puerto 5579
- **App path**: `/var/www/diparola`
- **PM2 process**: `diparola`
- **Backup DB**: Cron diario 3AM en `/var/backups/diparola/`, retención 30 días
