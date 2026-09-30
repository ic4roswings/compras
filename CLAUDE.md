# CLAUDE.md — Proyecto "Compras"

Sistema personal de lista de compras (Walmart/Costco/etc.), comidas recurrentes, pendientes y control de gastos. Idioma del proyecto: **español** (nombres de modelos, endpoints, variables, commits). Responde y comenta en español.

## Estructura del monorepo

`/home/angel/proyectos/compras` **no es un repo git**; cada subproyecto tiene su propio `.git` independiente. Haz commits dentro de cada subcarpeta.

| Carpeta | Qué es | Stack |
|---|---|---|
| `backend/` | API REST | Django 5.2, DRF, SimpleJWT, PostgreSQL, Python 3.12 |
| `frontend/` | Web (v2.2.x) | Angular 20, componentes standalone, Bootstrap 5, SweetAlert2 |
| `app/` | App móvil Android | Ionic 8 + Angular 19 (NgModules) + Capacitor 7 |
| `comprasMCP/` | Servidor MCP para agentes IA (n8n) | FastMCP (`mcp==1.6.0`), transporte SSE, Python 3.10 |

Producción: web `compras.icaroswings.com`, ionic `ionic.icaroswings.com`, API `backcompras.icaroswings.com`.

## Backend (`backend/`)

App única Django: `compras/` (proyecto y app comparten nombre).

- `compras/apiViews.py` (~640 líneas): **todas** las vistas (`APIView` de DRF, `IsAuthenticated` salvo `LoginView` y `ComidasUnicasView`).
- `compras/urls.py`: todas las rutas, sin prefijo `/api`. Rutas clave: `productos/`, `productos/<id>`, `productos/<nombre>` (búsqueda), `lista/`, `damelista/`, `dameEncargado/`, `walmart/`, `comidas/`, `agregaComidas/`, `pendientes/`, `gastos/*`, `login/`, `token/refresh|verify/`.
- `compras/models.py`: `Producto`, `Lista`, `Encargo`, `Comidas`, `Pendiente`. Flujo: `Lista` (por comprar) → `transferir_lista_a_encargos()` → `Encargo` (encargado a otra persona, consolidando duplicados de Walmart).
- `compras/models_gastos.py`: `Operaciones`, `OperacionesHistorico`, `Meses`, `CategoriaResumen` — todos `managed = False`, tablas existentes en **otra base de datos** (`gastos_db`).
- `compras/db_routers.py` (`GastosRouter`): enruta esos modelos a `gastos_db`; migraciones solo en `default` para el resto. Si añades un modelo de gastos, agrégalo a `gastos_models`.
- `compras/services.py`: lógica de negocio (transferencias lista→encargo, resumen de gastos; filtra `operacion='Egreso'` y `cuenta='*676'`).
- `compras/vector_service.py` + comando `python manage.py sync_vectores`: búsqueda semántica de productos con **PGVector + LangChain + OpenAI `text-embedding-ada-002`**. `ProductoFiltradoView` cae a búsqueda vectorial (k=5) si la búsqueda por nombre no da resultados; crear/editar/borrar producto mantiene el vector sincronizado. El texto vectorizado = nombre + slug de la URL de Walmart.
- Login: el front cifra la contraseña con **RSA (clave pública)**; `LoginView` la descifra con `backend/privateKey.pem` (ruta relativa: ejecutar desde `backend/`) y emite JWT (access 1 día, refresh 7 días).
- Config por `.env` (`DB_ENGINE`, `DB_NAME`, `DB_USER`, `DB_HOST`, `DB_PORT`, `DB_NAME_GASTOS`, `DB_USER_GASTOS`, `DB_PORT_GASTOS`, `VECTOR_DB_URL`, `OPENAI_API_KEY`, `SECURE_SSL_REDIRECT`…). CORS permitido por lista; en `DEBUG` se suman localhost (4200, 8100, 8101).
- `main.py` es un stub de PyCharm sin uso. `Procfile`/`runtime.txt` son restos de despliegue tipo Heroku; el despliegue real es Docker + gunicorn.

Comandos (desde `backend/`, con `.venv`):
```bash
source .venv/bin/activate
pip install -r requirements.txt
python manage.py runserver          # dev (el front de dev apunta a :8002, la app ionic a :8000)
python manage.py migrate
python manage.py sync_vectores      # reindexa todos los productos en pgvector
docker build -t compras_python . && docker compose up -d   # prod: gunicorn -w 4 :8000, red 172.18.0.2
```
No hay tests escritos.

## Frontend web (`frontend/`)

Angular 20 **standalone** (sin NgModules), `app.routes.ts`: `login`, `productos`, `lista`, `semanal`, `comidas[/:comida]`, `agregarComidas/...`, `encargado`, `actualizar/:numero`, `pendientes`.

- Estructura: `src/app/<feature>/` (componente ts/html/css), `service/` (un servicio por dominio: lista, producto, comidas, encargo, pendientes, semanal, login, rsa, global), `interface/`, `enum/`, `directives/`.
- `auth.interceptor.ts`: añade `Authorization: Bearer` desde `localStorage.token`. `GlobalService.checkTokens()` verifica/refresca el JWT (`token`, `refresh` en localStorage).
- `rsa.service.ts`: cifra la contraseña con `node-forge` y la clave pública embebida (par de `backend/privateKey.pem`).
- `environment.ts` (dev → `http://127.0.0.1:8002/`) / `environment.prod.ts` (→ `https://backcompras.icaroswings.com/`).
- Despliegue: `ng build` → `dist/compras/*` → imagen nginx (`Dockerfile`, `nginx.conf` con fallback SPA) en puerto 80.

```bash
cd frontend && npm install
npm start        # ng serve
npm run build
npm test         # karma/jasmine
```

## App móvil (`app/`)

Ionic 8 / Angular 19 **con NgModules** (distinto al web). Capacitor `appId: com.icaroswings.compras`, `webDir: www`, plataforma Android (`app/android`). Solo tiene `login` y `folder/:id` (lista filtrada por tienda, por defecto Walmart) protegido por `AuthGuard`.

- `interceptor.service.ts` reenvía las peticiones a través de `@awesome-cordova-plugins/http` (HTTP nativo) — ojo: esa dependencia **no está en `package.json`**; verifícala antes de compilar.
- `environment.ts` dev → `http://127.0.0.1:8000/`.
- Comandos: `npm start`, `npm run build`, `npm run lint`, luego `npx cap sync android` / `npx cap open android`.

## MCP (`comprasMCP/`)

`servidor.py` (único archivo): `FastMCP("Compras-API")`, `mcp.run(transport='sse')`, puerto 8000 en contenedor (9091 en host).

Herramientas: `buscar_producto_catalogo`, `crear_y_agregar_producto`, `agregar_a_lista_existente`, `ver_lista_compras(tienda?)`. Consumen la API Django (`SERV_URL` + `/productos/`, `/lista/`, `/damelista/`).

- **Autenticación**: no hace login; lee el `access_token` de la tabla `current_auth` en Postgres (`DB_*` en `.env`), que renueva un flujo externo (n8n). Si el token expiró, las herramientas fallan.
- Docker: `Dockerfile` (Python 3.10, TZ America/Mexico_City), `compose.yml` (red 172.25.0.0/24). `deploy.sh` construye la imagen como `chepe_server` mientras `compose.yml` usa `compras_server:latest` — inconsistencia a corregir antes de confiar en el script.
- Nota: `buscar_producto_catalogo` usa `nombre.capitalize()` en la URL; el backend ya tiene fallback vectorial.

## Convenciones

- Nombres de dominio en español: `donde` = tienda, `unidades`, `cantidad`, `semanal`/`mensual`/`verificar` = banderas de recurrencia en `Producto`.
- Versionado en commits con emoji + versión (`✅ V2.1.0 …` feature, `🐛 V2.1.1 …` fix).
- Los POST de `productos/` y `lista/` aceptan **listas** de objetos (el MCP y el front envían arrays).

## Seguridad / cuidados

- `.claude/settings.json` deniega leer `.env` y archivos `*secret*`; no los leas ni imprimas. `backend/privateKey.pem` es la clave privada RSA: nunca mostrarla ni commitearla a otro lado.
- `backend/.env`, `comprasMCP/.env` y `comprasMCP/env` contienen credenciales.
- Puntos débiles conocidos: `django-debug-toolbar` está en `INSTALLED_APPS`/middleware incondicionalmente; `LANGUAGE_CODE='en-us'`; `ComidasUnicasView` sin autenticación; `STATIC_ROOT=''`.
