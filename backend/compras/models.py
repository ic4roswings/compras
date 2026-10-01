from django.db import models


class Producto(models.Model):
    nombre = models.CharField(max_length=150)
    donde = models.CharField(max_length=30)
    cantidad = models.IntegerField()
    unidades = models.CharField(max_length=50)
    upc = models.CharField(max_length=15, default='')
    display = models.CharField(max_length=200, default='')
    medida = models.CharField(max_length=5, default='')
    URL = models.CharField(max_length=500, default='')
    average_weight = models.IntegerField(default=0)
    weighable = models.BooleanField(default=False)
    semanal = models.BooleanField()
    mensual = models.BooleanField()
    verificar = models.BooleanField()

    def __str__(self):
        return self.nombre


class Lista(models.Model):
    id = models.AutoField(primary_key=True)
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='producto')
    cantidad = models.IntegerField()
    unidades = models.CharField(max_length=50, default='')

    def __str__(self):
        return self.producto.nombre


class Encargo(models.Model):
    id = models.AutoField(primary_key=True)
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='productoF')
    cantidad = models.IntegerField()
    unidades = models.CharField(max_length=50, default='')

    def __str__(self):
        return self.producto.nombre

class BaseComida(models.Model):
    """Catálogo de bases de las comidas (pollo, res, pavo...). Se alimenta al crear/editar comidas."""
    nombre = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.nombre


class Comida(models.Model):
    """Encabezado de una comida: el ente al que se ligan sus ingredientes y las métricas."""
    TIPOS = [(1, 'Entre semana'), (2, 'Fin de semana')]

    nombre = models.CharField(max_length=50, unique=True)
    tipo = models.PositiveSmallIntegerField(choices=TIPOS, default=1)
    base = models.ForeignKey(BaseComida, null=True, blank=True, on_delete=models.SET_NULL, related_name='comidas_base')

    def __str__(self):
        return self.nombre


class ComidaIngrediente(models.Model):
    """Un producto (con cantidad y unidades) que compone una comida."""
    comida = models.ForeignKey(Comida, on_delete=models.CASCADE, related_name='ingredientes')
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='ingredientes_comida')
    cantidad = models.IntegerField()
    unidades = models.CharField(max_length=50, default='')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['comida', 'producto'], name='comida_producto_unico'),
        ]

    def __str__(self):
        return f'{self.comida.nombre}: {self.producto.nombre}'


class Comidas(models.Model):
    """LEGADO: estructura anterior (una fila por ingrediente). Se conserva como respaldo; ya no se usa.
    Ver Comida y ComidaIngrediente."""
    TIPOS = [(1, 'Entre semana'), (2, 'Fin de semana')]

    id = models.AutoField(primary_key=True)
    comida = models.CharField(max_length=50)
    # Igual en todas las filas (ingredientes) de una misma comida
    tipo = models.PositiveSmallIntegerField(choices=TIPOS, default=1)
    # Igual en todas las filas de una misma comida; null = sin base asignada
    base = models.ForeignKey(BaseComida, null=True, blank=True, on_delete=models.SET_NULL, related_name='comidas')
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE, related_name='productoC')
    cantidad = models.IntegerField()
    unidades = models.CharField(max_length=50, default='')

    def __str__(self):
        return self.producto
    
class Pendiente(models.Model):
    id = models.AutoField(primary_key=True)
    pendiente = models.CharField(max_length=500, default='')

    def __str__(self):
        return self.pendiente


class HistorialCompra(models.Model):
    """Una compra de un producto: se registra al vaciar Encargo en transferir_lista_a_encargos()."""
    id = models.AutoField(primary_key=True)
    producto = models.ForeignKey(Producto, on_delete=models.SET_NULL, null=True, related_name='historial')
    nombre = models.CharField(max_length=150)
    donde = models.CharField(max_length=30, default='')
    cantidad = models.IntegerField()
    unidades = models.CharField(max_length=50, default='')
    fecha = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return f'{self.nombre} ({self.fecha:%Y-%m-%d})'


class HistorialComida(models.Model):
    """Una vez que se hizo una comida: se registra al agregar sus ingredientes a la lista."""
    id = models.AutoField(primary_key=True)
    comida = models.ForeignKey(Comida, null=True, on_delete=models.SET_NULL, related_name='historial')
    nombre = models.CharField(max_length=50, db_index=True)
    fecha = models.DateTimeField(auto_now_add=True, db_index=True)

    def __str__(self):
        return f'{self.nombre} ({self.fecha:%Y-%m-%d})'

