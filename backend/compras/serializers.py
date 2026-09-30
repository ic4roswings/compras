from rest_framework import serializers
from .models import Comidas, Producto, Pendiente, Lista
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

    producto = SubProductoSerializer(many=False)

    class Meta:
        model = Comidas
        fields = ['id', 'comida', 'producto', 'cantidad', 'unidades']

class InsertaComidaSerializer(serializers.ModelSerializer):


    class Meta:
        model = Comidas
        fields = ['comida', 'producto', 'cantidad', 'unidades']


class ComidaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comidas
        fields = ['comida']

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