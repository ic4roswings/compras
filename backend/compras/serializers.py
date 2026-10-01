from rest_framework import serializers
from .models import ComidaIngrediente, Producto, Pendiente, Lista
from .models_gastos import CategoriaResumen, Operaciones, OperacionesHistorico

class ProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producto
        fields = ['id', 'nombre', 'donde', 'cantidad', 'unidades', 'semanal', 'mensual', 'verificar', 'upc', 'medida', 'URL']


class SubProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producto
        fields = ['id', 'nombre', 'donde', 'upc', 'medida', 'URL']


class PendienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pendiente
        fields = ['id', 'pendiente']

class AgregaPendienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pendiente
        fields = ['pendiente']


class FinalListaSerializer(serializers.ModelSerializer):

    producto = SubProductoSerializer(many=False)

    class Meta:
        model = Lista
        fields = ['id', 'producto', 'cantidad', 'unidades']


class ListaSerializer(serializers.ModelSerializer):

    class Meta:
        model = Lista
        fields = ['id', 'cantidad', 'producto', 'unidades']

class FinalComidaSerializer(serializers.ModelSerializer):
    """Un ingrediente de una comida con los datos del encabezado (misma forma que la tabla anterior)."""

    producto = SubProductoSerializer(many=False)
    comida = serializers.CharField(source='comida.nombre', read_only=True)
    tipo = serializers.IntegerField(source='comida.tipo', read_only=True)
    base = serializers.CharField(source='comida.base.nombre', read_only=True, default=None)

    class Meta:
        model = ComidaIngrediente
        fields = ['id', 'comida', 'tipo', 'base', 'producto', 'cantidad', 'unidades']


class InsertaComidaSerializer(serializers.Serializer):
    """Valida un ingrediente a agregar; `tipo` y `base` son opcionales y afectan al encabezado de la comida."""

    comida = serializers.CharField(max_length=50)
    producto = serializers.PrimaryKeyRelatedField(queryset=Producto.objects.all())
    cantidad = serializers.IntegerField()
    unidades = serializers.CharField(max_length=50, required=False, allow_blank=True, default='')
    tipo = serializers.ChoiceField(choices=[1, 2], required=False)
    base = serializers.CharField(max_length=50, required=False, allow_blank=True, allow_null=True)


class CategoriaResumenSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaResumen
        fields = ['categoria', 'total']

class PeriodoSerializer(serializers.Serializer):
    periodo = serializers.CharField()

class OperacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Operaciones
        fields = [
            'id', 'establecimiento', 'monto', 'operacion', 'autorizacion',
            'cuenta', 'tipo', 'categoria', 'fecha_creacion'
        ]


class OperacionHistoricoSerializer(serializers.ModelSerializer):
    class Meta:
        model = OperacionesHistorico
        fields = [
            'id', 'establecimiento', 'monto', 'operacion', 'autorizacion',
            'cuenta', 'tipo', 'categoria', 'fecha_operacion', 'periodo', 'fecha_archivado'
        ]   

class OperacionSerializerNoId(serializers.ModelSerializer):
    class Meta:
        model = Operaciones
        fields = [
            'establecimiento', 'monto', 'operacion', 'autorizacion',
            'cuenta', 'tipo', 'categoria'
        ]