from django.db import migrations


def poblar(apps, schema_editor):
    """Pasa la tabla vieja Comidas (una fila por ingrediente) a Comida + ComidaIngrediente y liga el historial."""
    Comidas = apps.get_model('compras', 'Comidas')
    Comida = apps.get_model('compras', 'Comida')
    ComidaIngrediente = apps.get_model('compras', 'ComidaIngrediente')
    HistorialComida = apps.get_model('compras', 'HistorialComida')

    filas = list(Comidas.objects.order_by('id'))

    # Encabezados: tipo = el menor de sus filas (normalmente iguales), base = la primera que tenga
    encabezados = {}
    for fila in filas:
        e = encabezados.setdefault(fila.comida, {'tipo': fila.tipo, 'base_id': None})
        e['tipo'] = min(e['tipo'], fila.tipo)
        if e['base_id'] is None and fila.base_id is not None:
            e['base_id'] = fila.base_id
    comidas = {
        nombre: Comida.objects.create(nombre=nombre, tipo=e['tipo'], base_id=e['base_id'])
        for nombre, e in encabezados.items()
    }

    # Ingredientes: si una comida repite el mismo producto, se suman las cantidades
    ingredientes = {}
    for fila in filas:
        clave = (fila.comida, fila.producto_id)
        if clave in ingredientes:
            ingredientes[clave].cantidad += fila.cantidad
        else:
            ingredientes[clave] = ComidaIngrediente(
                comida=comidas[fila.comida], producto_id=fila.producto_id,
                cantidad=fila.cantidad, unidades=fila.unidades,
            )
    ComidaIngrediente.objects.bulk_create(ingredientes.values())

    # Historial: se liga por nombre al encabezado
    for nombre, comida in comidas.items():
        HistorialComida.objects.filter(nombre=nombre, comida__isnull=True).update(comida=comida)

    # Verificación: si no cuadra, la migración aborta y no queda nada a medias
    if Comida.objects.count() != len(encabezados) or ComidaIngrediente.objects.count() != len(ingredientes):
        raise RuntimeError('La migración de comidas no cuadra con la tabla original')


class Migration(migrations.Migration):

    dependencies = [
        ('compras', '0023_comida_ingrediente'),
    ]

    operations = [
        # La tabla vieja Comidas no se toca; por eso la reversa no borra nada
        migrations.RunPython(poblar, migrations.RunPython.noop),
    ]
