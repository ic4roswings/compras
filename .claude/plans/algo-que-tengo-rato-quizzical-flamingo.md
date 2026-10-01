# Plan: la comida como entidad propia (encabezado + ingredientes)

## Contexto
Hoy `Comidas` (backend/compras/models.py) guarda una fila por ingrediente y repite el nombre de la comida,
el `tipo` y la `base` en cada fila; para que no se desincronicen hay que hacer `update` sobre todas las filas.
`HistorialComida` se liga a la comida solo por nombre (texto). Se quiere que la comida sea un ente aparte
(encabezado con ID), con sus ingredientes en una tabla hija, y que las métricas se liguen por ID.
Debe quedar igual para el frontend ("todo funciona como hasta ahorita") y **sin destruir la tabla actual**.

## Modelo nuevo (backend/compras/models.py)
- `Comida` (encabezado): `id`, `nombre` (unique, max 50), `tipo` (1 entre semana / 2 fin de semana, default 1),
  `base` FK -> `BaseComida` (null, SET_NULL).
- `ComidaIngrediente` (detalle): `id`, `comida` FK -> `Comida` (CASCADE, `related_name='ingredientes'`),
  `producto` FK -> `Producto` (CASCADE), `cantidad`, `unidades`; `UniqueConstraint(comida, producto)`.
- `HistorialComida`: el campo de texto `comida` se renombra a `nombre` (snapshot, igual que `HistorialCompra.nombre`)
  y se agrega `comida` FK -> `Comida` (null, SET_NULL). Así la métrica se liga por ID y sobrevive al renombrar/borrar.
- `Comidas` (tabla vieja): **se conserva sin tocar** como respaldo (solo se marca como legado en un docstring).
  Ninguna vista la vuelve a usar.

## Migraciones (en `default`; la tabla vieja no se modifica)
1. `0023_comida_ingrediente`: crea `Comida`, `ComidaIngrediente`; renombra `HistorialComida.comida`→`nombre`; agrega FK `comida`.
2. `0024_poblar_comidas` (`RunPython`, separada para no mezclar esquema y datos en Postgres):
   - Por cada nombre distinto en `Comidas` crea un `Comida` (tipo = el mínimo de sus filas, base = primera no nula).
   - Por cada fila crea su `ComidaIngrediente`; si hubiera duplicados (comida, producto) los suma.
   - Rellena `HistorialComida.comida` buscando por `nombre`.
   - Reversa: no-op (la tabla vieja sigue intacta).
   - Verificación dentro de la migración: nº de `Comida` = nombres distintos y nº de ingredientes = filas (suma de duplicados aparte); si no cuadra, aborta.

## Vistas y servicios (backend/compras/apiViews.py, serializers.py, services.py, urls.py)
Mismas rutas y mismo formato de respuesta; solo cambia lo que hay debajo:
- `FinalComidaSerializer`: ahora sobre `ComidaIngrediente`, con `comida` = `comida.nombre`, `tipo`, `base` (nombre) -> misma forma que hoy.
- `GeneraComidaView` (`dameComidas/<comida>/`): filtra por `comida__nombre__unaccent__icontains`.
- `ComidasUnicasView` (`comidas/`): lista `Comida` ordenada por nombre (`{comida: nombre}`, se añade `id`).
- `AgregaComidaView` (`agregaComidas/`): *upsert* del encabezado por nombre (tipo/base solo si vienen; `obtener_o_crear_base` se reutiliza)
  y *upsert* del ingrediente por (comida, producto). Desaparece el truco de heredar/propagar tipo y base fila por fila.
- `BorraComidaView` (`borraComidas/<comida>/<id>`, id = producto): borra el ingrediente; si la comida se queda sin ingredientes se borra el encabezado (igual que hoy, donde desaparecía de la lista).
- `BorraComidaCompletaView`: borra el encabezado (cascada a ingredientes); 404 si no existe.
- `RegistraComidaHechaView`: busca `Comida` por nombre, crea `HistorialComida(comida=obj, nombre=obj.nombre)`, deduplicado por día y por `comida_id`.
- `CambiaTipoComidaView` / `CambiaBaseComidaView`: actualizan el encabezado (un solo `update`).
- `services.metricas_comidas` y `services.sugerir_comidas`: agrupan por `comida_id` (si el historial perdió su comida, por `nombre`); muestran el nombre actual del encabezado; la base y el tipo salen de `Comida` directamente (se simplifica `Min('tipo')` y el dict de bases).
- `InsertaComidaSerializer`/`ComidaSerializer`: se eliminan o se reducen; ya no hacen falta.

## Frontend
Sin cambios obligatorios: las rutas y las formas JSON se mantienen. Opcional: aprovechar `id` en `comidas/` si se quiere.

## Archivos críticos
backend/compras/models.py, migrations/0023_*, 0024_*, apiViews.py (sección comidas ~l.400-530 y 715-790), serializers.py, services.py (métricas/sugerencias), urls.py (sin cambios de ruta).

## Verificación
1. Respaldo previo de `dev-compras` (`pg_dump`, lo corres tú con `!`) antes de migrar.
2. `makemigrations` limpio; `migrate` en `dev-compras`; comprobar conteos: `Comida` = nombres distintos de `Comidas`, ingredientes = filas, `HistorialComida` sin FK huérfana.
3. Comparar respuestas antes/después para todas las rutas de comidas (`comidas/`, `dameComidas/<x>/`, `agregaComidas/`, `borraComidas`, `comidas/<x>/` DELETE, `hecha`, `tipo`, `base`, `sugerencias`, `metricas/comidas`) con rollback en transacción.
4. `ng build` y recorrer en el navegador: crear comida (tipo/base), editar ingredientes, cambiar tipo/base, borrar ingrediente y comida completa, agregar a la lista, ver métricas y sugerencias (incl. "Otras").
5. La tabla `Comidas` queda intacta (mismo conteo al final).

## Decisiones tomadas (avísame si prefieres otra)
- Al borrar el último ingrediente se borra también el encabezado (conserva el comportamiento actual); el historial queda con su `nombre` y sin FK.
- La tabla vieja se queda como respaldo; su eliminación definitiva sería una migración aparte cuando confirmes que todo funciona.
- Producción: las migraciones `0020`–`0024` están pendientes allá; hacer respaldo antes de desplegar.
