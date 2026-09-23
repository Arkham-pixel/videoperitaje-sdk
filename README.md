# Videoperitaje SDK — API intermedia
#
# Flujo: Arnald → este SDK → Postgres (schema videoperitaje)
#
# Endpoints (header obligatorio: x-api-key: <API_KEY>)
#   GET  /health
#   GET  /v1/cupo?modulo=bbva-cat
#   POST /v1/sesiones
#   PATCH /v1/sesiones/:mongoSesionId
#   POST /v1/sesiones/:mongoSesionId/eventos
#   GET  /v1/companias
#
# Coolify: variables de .env.example + hostname interno de Postgres.

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
