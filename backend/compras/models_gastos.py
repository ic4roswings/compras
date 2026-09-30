from django.db import models


class Operaciones(models.Model):
    id = models.AutoField(primary_key=True) 
    establecimiento = models.CharField(max_length=50, blank=True, null=True)
    monto = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    operacion = models.CharField(max_length=50, blank=True, null=True)
    autorizacion = models.CharField(max_length=20, blank=True, null=True)
    cuenta = models.CharField(max_length=50, blank=True, null=True)
    tipo = models.CharField(max_length=50, blank=True, null=True)
    categoria = models.CharField(max_length=25, blank=True, null=True)
    fecha_creacion = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'operaciones'


class OperacionesHistorico(models.Model):
    id = models.AutoField(primary_key=True) 
    establecimiento = models.CharField(max_length=50, blank=True, null=True)
    monto = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    operacion = models.CharField(max_length=10050, blank=True, null=True)
    autorizacion = models.CharField(max_length=20, blank=True, null=True)
    cuenta = models.CharField(max_length=50, blank=True, null=True)
    tipo = models.CharField(max_length=50, blank=True, null=True)
    categoria = models.CharField(max_length=25, blank=True, null=True)
    fecha_operacion = models.DateTimeField(blank=True, null=True)
    periodo = models.CharField(max_length=7, blank=True, null=True)
    fecha_archivado = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'operaciones_historico'

class CategoriaResumen(models.Model):
    categoria = models.CharField(max_length=50, null=True)
    total = models.DecimalField(max_digits=10, decimal_places=2, null=True)

    class Meta:
        managed = False 



class Meses(models.Model):
    monto = models.DecimalField(max_digits=12, decimal_places=2)
    meses = models.IntegerField()
    establecimiento = models.TextField(null=True, blank=True)
    operacion = models.TextField(null=True, blank=True)
    autorizacion = models.TextField(null=True, blank=True)
    cuenta = models.TextField(null=True, blank=True)
    tipo = models.TextField(null=True, blank=True)
    categoria = models.TextField(null=True, blank=True)
    fecha_operacion = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'meses'
        managed = False