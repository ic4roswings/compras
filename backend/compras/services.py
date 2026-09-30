from django.db import transaction
from django.db.models import Sum, Count
from typing import List, Optional
from .models import Lista, Encargo, Producto
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

def transferir_lista_a_encargos(modo_limpieza: str = 'todo') -> None:
    """
    Transfers all items from Lista to Encargo.
    modo_limpieza options:
    - 'todo': Clears all existing Encargos first.
    - 'no_costco': Clears only non-Costco items from Encargos.
    - 'nada': Does not clear any existing Encargos (additive).
    """
    with transaction.atomic():
        if modo_limpieza == 'todo':
            Encargo.objects.all().delete()
        elif modo_limpieza == 'no_costco':
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
