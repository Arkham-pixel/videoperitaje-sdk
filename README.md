# Videoperitaje SDK — API intermedia
#
# Flujo: Arnald → este SDK → Postgres (schema videoperitaje)
#
# URL producción: https://videosdk.binaria.online
#
# Endpoints (header: x-api-key)
#   GET  /health
#   GET  /v1/cupo?modulo=independiente
#   POST /v1/sesiones   (incluye programada_at)
#   GET  /v1/sesiones/:mongoId/puede-iniciar
#   PATCH /v1/sesiones/:mongoId
#   POST /v1/sesiones/:mongoId/eventos
#   GET  /v1/companias
#
# Tras desplegar, ejecutar en Postgres:
#   sql/001_grupoproser_programada.sql
#
# Coolify vars: API_KEY, PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, PGSSL=0, CORS_ORIGIN


## Local

```bash
cp .env.example .env
# editar PG* y API_KEY
npm install
npm run dev
```

## Producción (Coolify)

1. Nuevo recurso desde este repo / Dockerfile
2. Variables: `API_KEY`, `PGHOST` (nombre del servicio Postgres), `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGSSL=0`
3. Misma red Docker que el Postgres `VideoPeritaje`
4. En Arnald (después): `VIDEOPERITAJE_SDK_URL` + `VIDEOPERITAJE_SDK_KEY`
