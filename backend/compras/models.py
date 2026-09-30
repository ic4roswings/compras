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

class Comidas(models.Model):
    id = models.AutoField(primary_key=True)
    comida = models.CharField(max_length=50)
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



