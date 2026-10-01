import random
from django.db import transaction
from django.db.models import Sum, Count, Max
from typing import List, Optional
from django.utils import timezone
from .models import Lista, Encargo, Producto, Comida, BaseComida, HistorialCompra, HistorialComida
from .models_gastos import Operaciones, OperacionesHistorico
from decimal import Decimal

def unificar_encargos_walmart() -> None:
    """
    Consolidates duplicate product entries in the Encargo table for Walmart.
    Sums the quantity of duplicate entries and recreates them as a single entry.
    """
    duplicados = (
        Encargo.objects.filter(producto__donde__iexact='Walmart')
        .values('producto', 'unidades')
        .annotate(num_registros=Count('id'), total_cantidad=Sum('cantidad'))
        .filter(num_registros__gt=1)
    )

    if not duplicados:
        return

    with transaction.atomic():
        for grupo in duplicados:
            prod_id = grupo['producto']
            unidad = grupo['unidades']
            cantidad_nueva = grupo['total_cantidad']

            # Eliminamos todos los registros duplicados de este producto/unidad en Walmart
            Encargo.objects.filter(
                producto_id=prod_id, 
                unidades=unidad, 
                producto__donde__iexact='Walmart'
            ).delete()

            # Insertar dejando que la base de datos maneje el ID
            Encargo.objects.create(
                producto_id=prod_id,
                unidades=unidad,
                cantidad=cantidad_nueva
            )

def registrar_compras(encargos) -> None:
    """Guarda en HistorialCompra cada encargo recibido (snapshot de nombre/tienda/cantidad)."""
    HistorialCompra.objects.bulk_create([
        HistorialCompra(
            producto=e.producto,
            nombre=e.producto.nombre,
            donde=e.producto.donde,
            cantidad=e.cantidad,
            unidades=e.unidades,
        ) for e in encargos.select_related('producto')
    ])


def _frecuencia(fechas: List) -> dict:
    """Veces, primera/última fecha y días promedio entre ocurrencias (fechas ordenadas ascendente)."""
    dias = sorted({timezone.localtime(f).date() for f in fechas})
    intervalos = [(b - a).days for a, b in zip(dias, dias[1:])]
    ultima = dias[-1]
    return {
        'veces': len(fechas),
        'primera': dias[0],
        'ultima': ultima,
        'dias_desde_ultima': (timezone.localdate() - ultima).days,
        'promedio_dias': round(sum(intervalos) / len(intervalos), 1) if intervalos else None,
    }


def metricas_productos() -> List[dict]:
    """Frecuencia de compra por producto (por nombre), la más comprada primero."""
    agrupado = {}
    for nombre, donde, fecha in HistorialCompra.objects.order_by('fecha').values_list('nombre', 'donde', 'fecha'):
        agrupado.setdefault((nombre, donde), []).append(fecha)
    resultado = [{'nombre': n, 'donde': d, **_frecuencia(f)} for (n, d), f in agrupado.items()]
    return sorted(resultado, key=lambda r: (-r['veces'], r['nombre']))


def metricas_comidas() -> List[dict]:
    """Frecuencia con que se hace cada comida (por ID; si el historial perdió su comida, por nombre)."""
    agrupado = {}
    filas = HistorialComida.objects.order_by('fecha').values_list('comida_id', 'comida__nombre', 'nombre', 'fecha')
    for comida_id, nombre_actual, nombre_historial, fecha in filas:
        clave = comida_id or nombre_historial
        grupo = agrupado.setdefault(clave, {'id': comida_id, 'comida': nombre_actual or nombre_historial, 'fechas': []})
        grupo['fechas'].append(fecha)
    resultado = [{'id': g['id'], 'comida': g['comida'], **_frecuencia(g['fechas'])} for g in agrupado.values()]
    return sorted(resultado, key=lambda r: (-r['veces'], r['comida']))


def obtener_o_crear_base(nombre: Optional[str]) -> Optional[BaseComida]:
    """Busca la base en el catálogo (sin importar acentos ni mayúsculas) o la crea. Vacío = sin base."""
    nombre = (nombre or '').strip()
    if not nombre:
        return None
    existente = BaseComida.objects.filter(nombre__unaccent__iexact=nombre).first()
    return existente or BaseComida.objects.create(nombre=nombre)


COMIDAS_RECIENTES = 3  # cuántas de las últimas comidas hechas se miran para no repetir base


def sugerir_comidas(por_tipo: int = 2, excluir: Optional[List[str]] = None) -> List[dict]:
    """
    Sugiere comidas que llevan más tiempo sin hacerse: `por_tipo` de entre semana (tipo 1) y
    `por_tipo` de fin de semana (tipo 2). Las que nunca se han registrado van primero (aleatorias);
    el resto, de la más antigua a la más reciente. Se prefieren las de una base distinta a la de
    las últimas comidas hechas (y distinta entre sí); si no hay alternativa, se permite repetir.
    Si un tipo no tiene suficientes comidas, se completa con las mejores del otro.
    `excluir` son comidas ya sugeridas (para "otras sugerencias"); si no quedan suficientes, se ignora.
    """
    ultimas = dict(
        HistorialComida.objects.filter(comida__isnull=False)
        .values('comida_id').annotate(ultima=Max('fecha')).values_list('comida_id', 'ultima')
    )
    comidas = list(Comida.objects.select_related('base'))
    recientes = {
        base for base in HistorialComida.objects.filter(comida__isnull=False)
        .order_by('-fecha').values_list('comida__base__nombre', flat=True)[:COMIDAS_RECIENTES]
        if base
    }

    disponibles = [c for c in comidas if c.nombre not in set(excluir or ())]
    if len(disponibles) >= 2 * por_tipo:
        comidas = disponibles

    hoy = timezone.localdate()
    nunca, hechas = [], []
    for c in comidas:
        r = {'id': c.id, 'comida': c.nombre, 'tipo': c.tipo, 'base': c.base.nombre if c.base else None}
        if c.id in ultimas:
            r['dias_desde_ultima'] = (hoy - timezone.localtime(ultimas[c.id]).date()).days
            hechas.append(r)
        else:
            r['dias_desde_ultima'] = None
            nunca.append(r)
    random.shuffle(nunca)
    hechas.sort(key=lambda r: -r['dias_desde_ultima'])
    ordenadas = nunca + hechas
    # Las de base reciente quedan al final (se usan solo si no hay otras)
    ordenadas = [r for r in ordenadas if r['base'] not in recientes] + [r for r in ordenadas if r['base'] in recientes]

    elegidas, usadas = [], set(recientes)
    for tipo in (1, 2):
        candidatas = [r for r in ordenadas if r['tipo'] == tipo and r not in elegidas]
        for _ in range(por_tipo):
            if not candidatas:
                break
            r = next((c for c in candidatas if c['base'] not in usadas), candidatas[0])
            candidatas.remove(r)
            elegidas.append(r)
            if r['base']:
                usadas.add(r['base'])
    faltan = 2 * por_tipo - len(elegidas)
    if faltan > 0:
        elegidas += [r for r in ordenadas if r not in elegidas][:faltan]
    return elegidas


def transferir_lista_a_encargos(modo_limpieza: str = 'todo') -> None:
    """
    Transfers all items from Lista to Encargo.
    modo_limpieza options:
    - 'todo': Clears all existing Encargos first.
    - 'no_costco': Clears only non-Costco items from Encargos.
    - 'nada': Does not clear any existing Encargos (additive).
    """
    with transaction.atomic():
        # Lo que se va a borrar de Encargo (ya con las ediciones del usuario) cuenta como comprado
        if modo_limpieza == 'todo':
            registrar_compras(Encargo.objects.all())
            Encargo.objects.all().delete()
        elif modo_limpieza == 'no_costco':
            registrar_compras(Encargo.objects.exclude(producto__donde='Costco'))
            exclusiones = Encargo.objects.exclude(producto__donde='Costco')
            Encargo.objects.filter(id__in=exclusiones.values_list('id', flat=True)).delete()
        # if 'nada', we do nothing
            
        listado = Lista.objects.all()
        nuevos_encargos = [
            Encargo(
                producto=item.producto,
                cantidad=item.cantidad,
                unidades=item.unidades
            ) for item in listado
        ]
        Encargo.objects.bulk_create(nuevos_encargos)
        unificar_encargos_walmart()
        Lista.objects.all().delete()

def obtener_resumen_gastos(periodo: Optional[str] = None) -> List[dict]:
    """
    Returns a summary of expenses by category for a given period.
    """
    if periodo:
        queryset = OperacionesHistorico.objects.filter(periodo=periodo)
    else:
        queryset = Operaciones.objects.all()

    resumen = (
        queryset.filter(operacion='Egreso', cuenta='*676')
        .values('categoria')
        .annotate(total=Sum('monto'))
        .order_by('-total')
    )
    return list(resumen)
