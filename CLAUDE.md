# CLAUDE.md — Proyecto "Compras"

Sistema personal de lista de compras (Walmart/Costco/etc.), comidas recurrentes, pendientes y control de gastos. Idioma del proyecto: **español** (nombres de modelos, endpoints, variables, commits). Responde y comenta en español.

## Estructura del monorepo

`/home/angel/proyectos/compras` es **un solo repo git** (remoto `ic4roswings/compras`, rama `main`); `backend/`, `frontend/`, `app/` y `comprasMCP/` son carpetas del mismo repo, sin `.git` propio. Haz los commits desde la raíz y agrega los archivos por ruta (`git add backend/... frontend/...`).

| Carpeta | Qué es | Stack |
|---|---|---|
| `backend/` | API REST | Django 5.2, DRF, SimpleJWT, PostgreSQL, Python 3.12 |
| `frontend/` | Web (v2.2.x) | Angular 20, componentes standalone, Bootstrap 5, SweetAlert2 |
| `app/` | App móvil Android | Ionic 8 + Angular 19 (NgModules) + Capacitor 7 |
| `comprasMCP/` | Servidor MCP para agentes IA (n8n) | FastMCP (`mcp==1.6.0`), transporte SSE, Python 3.10 |

Producción: web `compras.icaroswings.com`, ionic `ionic.icaroswings.com`, API `backcompras.icaroswings.com`.

**Despliegue: se hace solo al hacer `git push` a `main`.** No hay que construir imágenes ni correr nada a mano. Por eso: (1) todo lo que se sube a `main` llega a producción, así que no subas código sin probar; (2) las migraciones **no** se aplican con el despliegue: córrelas tú contra la base de producción *antes* del push si el código nuevo las necesita (esquema que se agrega), y *justo antes* del push si borran algo, para que el código viejo no falle más de lo necesario; (3) tras el push, espera a que termine el despliegue antes de dar la tarea por cerrada.

## Backend (`backend/`)

App única Django: `compras/` (proyecto y app comparten nombre).

- `compras/apiViews.py` (~640 líneas): **todas** las vistas (`APIView` de DRF, `IsAuthenticated` salvo `LoginView` y `ComidasUnicasView`).
- `compras/urls.py`: todas las rutas, sin prefijo `/api`. Rutas clave: `productos/`, `productos/<id>`, `productos/<nombre>` (búsqueda), `lista/`, `damelista/`, `dameEncargado/`, `walmart/`, `comidas/`, `agregaComidas/`, `pendientes/`, `gastos/*`, `login/`, `token/refresh|verify/`.
- `compras/models.py`: `Producto`, `Lista`, `Encargo`, `Comida` + `ComidaIngrediente`, `BaseComida`, `Pendiente`, `HistorialCompra`, `HistorialComida`. Flujo: `Lista` (por comprar) → `transferir_lista_a_encargos()` → `Encargo` (encargado a otra persona, consolidando duplicados de Walmart).
- `compras/models_gastos.py`: `Operaciones`, `OperacionesHistorico`, `Meses`, `CategoriaResumen` — todos `managed = False`, tablas existentes en **otra base de datos** (`gastos_db`).
- `compras/db_routers.py` (`GastosRouter`): enruta esos modelos a `gastos_db`; migraciones solo en `default` para el resto. Si añades un modelo de gastos, agrégalo a `gastos_models`.
- `compras/services.py`: lógica de negocio (transferencias lista→encargo, resumen de gastos; filtra `operacion='Egreso'` y `cuenta='*676'`).
- `compras/vector_service.py` + comando `python manage.py sync_vectores`: búsqueda semántica de productos con **PGVector + LangChain + OpenAI `text-embedding-ada-002`**. `ProductoFiltradoView` cae a búsqueda vectorial (k=5) si la búsqueda por nombre no da resultados; crear/editar/borrar producto mantiene el vector sincronizado. El texto vectorizado = nombre + slug de la URL de Walmart.
- **Comidas** (`Comida` encabezado → `ComidaIngrediente`): `Comida` tiene `nombre` único, `tipo` (1 entre semana, 2 fin de semana) y `base` (FK a `BaseComida`, p. ej. pollo/res/pavo); `ComidaIngrediente` es único por (comida, producto) con `cantidad` y `unidades`. La antigua tabla `Comidas` (una fila por ingrediente, con nombre/tipo/base repetidos) se eliminó con la migración 0025; la 0024 pobló las tablas nuevas desde ella.
  - La API conserva las rutas y formas anteriores: `comidas/` (`[{id, comida}]`), `dameComidas/<comida>/` (búsqueda `unaccent`+`icontains`; filas con `id` del ingrediente, `comida`, `tipo`, `base`, `producto`, `cantidad`, `unidades`), `agregaComidas/` (lista; hace *upsert* del encabezado por nombre y del ingrediente; `tipo` y `base` son opcionales y solo cambian si vienen), `borraComidas/<comida>/<producto_id>` (si era el último ingrediente borra la comida), `DELETE comidas/<comida>/`.
  - Nuevas: `POST comidas/<comida>/hecha/` (registra en `HistorialComida`, una vez por día), `POST comidas/<comida>/tipo/` y `POST comidas/<comida>/base/`, `GET bases/`, `GET sugerencias/comidas/?excluir=<comida>&…`, `GET metricas/productos/`, `GET metricas/comidas/`.
  - La base es **texto libre**: `services.obtener_o_crear_base()` la busca sin acentos ni mayúsculas o la crea; no hay pantalla de catálogo (se alimenta sola al capturar comidas).
- **Métricas**: `HistorialCompra` se escribe en `services.registrar_compras()`, llamada desde `transferir_lista_a_encargos()` con lo que hay en `Encargo` y se va a borrar (modo `todo` → todo, `no_costco` → lo que no es Costco, `nada` → no registra). `HistorialComida` se liga a `Comida` por FK (`SET_NULL`) y conserva `nombre` como respaldo; el front lo registra al agregar los ingredientes de una comida a la lista. No hay datos anteriores a la activación.
- **Sugerencias** (`services.sugerir_comidas`): 2 de entre semana + 2 de fin de semana; primero las comidas nunca hechas (aleatorias), luego las más antiguas; prefiere bases distintas a las de las últimas `COMIDAS_RECIENTES` (3) comidas hechas y distintas entre sí; `excluir` alimenta el botón "Otras" y, si no quedan suficientes, se reinicia. Las fechas se manejan en hora local (`timezone.localtime`/`localdate`); compararlas en UTC daba días negativos.
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

Migraciones y datos:
- Antes de `migrate`, comprueba **a qué base apunta `settings`** (nombre y host con `manage.py shell`; no leas `.env`): ya hubo ocasiones en que apuntaba a producción y no a desarrollo. Si la migración toca o borra datos, pide respaldo (`pg_dump`) antes.
- Las migraciones de datos (`RunPython`) van en su propia migración, separada del esquema, y verifican conteos para abortar si algo no cuadra (ver `0024_poblar_comidas`).
- La base de producción se migra a mano (el despliegue por push no corre migraciones); mientras tanto el backend desplegado sigue usando el esquema viejo. Una migración que **borra** tablas o columnas debe aplicarse inmediatamente antes del push del código que ya no las usa (p. ej. la 0025, que eliminó `Comidas`), porque entre ambos pasos el backend viejo falla.
- Muchos archivos usan fin de línea **CRLF** (`apiViews.py`, `models.py`, `urls.py`, `comidas.component.ts/css`, `comidas.service.ts`…) y otros LF. Si editas con un script, conserva el formato original de cada archivo; `git diff --stat` debe mostrar solo tus líneas y no el archivo completo.

## Frontend web (`frontend/`)

Angular 20 **standalone** (sin NgModules), `app.routes.ts`: `login`, `productos`, `lista`, `semanal`, `comidas[/:comida]`, `agregarComidas/...`, `encargado`, `checklist`, `actualizar/:numero`, `pendientes`, `metricas`.

- Estructura: `src/app/<feature>/` (componente ts/html/css), `service/` (un servicio por dominio: lista, producto, comidas, metricas, encargo, pendientes, semanal, login, rsa, global), `interface/`, `enum/`, `directives/`.
- Features de comidas/métricas: `metricas/` (tablas de frecuencia de productos y comidas con buscador y menú "Ver:"), `comidas/` (selector de comida, base y tipo; tarjeta de **sugerencias** con botón "Otras"; al agregar los ingredientes a la lista llama a `registraComidaHecha`), `nueva-comida/` (modal), `selector-comida/` (`app-selector-base` y `app-selector-tipo`, reutilizables).
- Convenciones de Angular: componentes standalone con `ChangeDetectionStrategy.OnPush`, estado con `signal`/`computed`, `inject()`, control flow `@if/@for/@switch` (`@for` siempre con `track`), y `await this.global.checkTokens('<ruta>')` al inicio de `ngOnInit`. Los iconos de Font Awesome se importan con `FontAwesomeModule` (no `FaIconComponent`, que no es standalone aquí) y se asignan a una propiedad del componente.

### Convenciones de interfaz (leer antes de tocar cualquier pantalla)

Es lo que más ha fallado: las pantallas nuevas deben verse como las existentes. Copia la estructura de `semanal/` y `producto/`.

- **Esqueleto de página**: `<section class="page-layout <nombre>-page animate-fade-in">` → `<app-cabecera titulo="…">` → `<div class="scroll-content"><div class="container h-100 d-flex flex-column py-3">`. Arriba, la tarjeta de filtros: `div.flex-shrink-0.animate-slide-in.header-controls` > `div.glass-card.mb-4.p-3` > `div.row.g-2.align-items-center`. Abajo, el contenido en `div.table-scroll.bg-transparent.border-0.shadow-none`. `header-controls` (`position: relative; z-index: 1000`) evita que los menús queden tapados por la tabla.
- **Filtros y selectores de página: nunca `<select>` nativo ni `<datalist>`**. Se usa el dropdown de Bootstrap con el estilo de vidrio: `div.dropdown.w-100` > `button.btn.modern-btn-secondary.w-100.d-flex.justify-content-between.align-items-center.p-2.px-3[data-bs-toggle=dropdown]` (icono `text-white-50`, etiqueta `small uppercase d-none d-sm-inline`, valor `fw-bold`, chevron) y `ul.dropdown-menu.dropdown-menu-dark.glass-dropdown.w-100.shadow-lg.mt-2` con `li > a.dropdown-item.py-2`. Con muchas opciones: `max-height: 350px; overflow-y: auto` y un `.search-box` pegajoso (`sticky-top bg-dark`) arriba, como en `comidas/`. Para tipo y base usa `app-selector-tipo` / `app-selector-base`.
- **Buscador de página**: `div.input-group.search-group` con `span.input-group-text` (icono) + `input.form-control.modern-input.border-start-0.ps-1` y, si hay texto, botón para limpiar (`faTimes`). Filtra sin acentos ni mayúsculas.
- **Tablas**: escritorio `div.table-responsive.glass-card` (`d-none d-md-block` si hay vista móvil) > `table.table.modern-table.mb-0`, filas `tr.modern-tr`, tienda como `span.badge-store[attr.data-store]`, acciones con `btn-action` (+`danger`). Móvil: tarjetas `glass-card p-3` dentro de `d-md-none` (ver `semanal`/`lista`). Estado vacío: icono `opacity-25` + `text-muted`; carga: `loading-container` con `spinner-modern`; error: `error-container`.
- **Dónde vive cada estilo**. Globales en `src/styles.scss`: `page-layout`, `scroll-content`, `table-scroll`, `glass-card`, `glass-dropdown`, `dropdown-item`, `btn-action`, `badge-store`, `page-title`, `spinner-modern`, `table`. **No** son globales y hay que copiarlos al CSS del componente nuevo (de `semanal.component.css` / `producto.component.css`): `modern-input`, `modern-btn-secondary`, `search-group`, `header-controls`, `modern-table`, `modern-select`, `qty-input`. Usa las variables (`--glass-surface`, `--glass-surface-hover`, `--glass-sunken`, `--border-color`, `--primary`, `--primary-glow`, `--text-primary|secondary|muted`, `--transition-fast`); no pongas colores sueltos.
- **Modales** (`glass-modal`, Bootstrap): el menú de un dropdown se recorta con el scroll del modal, así que ahí no se usan dropdowns. Usa `input.modern-input`, grupos de botones con estado seleccionado (`tipo-btn` / `.seleccionado`) o chips; si necesitas sugerencias de lo ya existente, muéstralas como botones bajo el campo (ver `nueva-comida/`).
- **Textos cortos donde falta espacio** (en los chips de sugerencias el tipo se muestra como "Entre"/"Fin"; en los selectores va completo).
- **Verificación**: `npx ng build` solo prueba que compila. Los fallos de estilo y de menús recortados solo se ven en el navegador (escritorio y ancho móvil); no des una pantalla por terminada sin revisarla ahí, o dilo explícitamente.
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
