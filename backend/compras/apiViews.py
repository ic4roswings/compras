from decimal import ROUND_HALF_UP, Decimal
import os

from rest_framework.permissions import IsAuthenticated

from . import settings
from .models import Comidas, Producto, Pendiente, Lista, Encargo
from .serializers import AgregaPendienteSerializer, ComidaSerializer, FinalComidaSerializer, InsertaComidaSerializer, ProductoSerializer, PendienteSerializer, ListaSerializer, FinalListaSerializer, CategoriaResumenSerializer, PeriodoSerializer, OperacionSerializer, OperacionHistoricoSerializer, OperacionSerializerNoId
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User
from django.contrib.auth.hashers import check_password
from django.utils import timezone
import json
import rsa
import base64
from .models_gastos import Meses, Operaciones, OperacionesHistorico
from django.db.models import Sum, Count, Max
from django.db import transaction
import pytz
import logging
from . import services
from .vector_service import get_vector_store, generate_vectorizer_text, sincronizar_vector_en_segundo_plano, sincronizar_vectores_en_segundo_plano, sincronizar_vectores, es_error_de_cuota, bloqueo_sincronizacion
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, format=None):
        username = request.data.get('username')
        enc_password = base64.b64decode(request.data.get('password'))
        with open('privateKey.pem', 'rb') as p:
            privateKey = rsa.PrivateKey.load_pkcs1(p.read())
        try:
            # password = rsa.decrypt(bytes.fromhex(enc_password), privateKey).decode('utf-8')
            password = rsa.decrypt(enc_password, privateKey).decode('utf-8')
        except Exception as e:
            return Response(json.loads('{"error": "Contraseña Incorrecta", "status": "Error"}'),
                            status=status.HTTP_200_OK)

        try:
            user = User.objects.get(username=username)

        except User.DoesNotExist:
            return Response(json.loads('{"error": "Usuario Incorrecto", "status": "Error"}'), status=status.HTTP_200_OK)

        pwd_valid = check_password(password, user.password)

        if not pwd_valid:
            return Response(json.loads('{"error": "Contraseña Incorrecta", "status": "Error"}'),
                            status=status.HTTP_200_OK)

        refresh = RefreshToken.for_user(user)

        response = {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'status': 'Ok',
        }

        return Response(response, status=status.HTTP_200_OK)


class ProductoListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, format=None):

        productos = Producto.objects.all()
        serializer = ProductoSerializer(productos, many=True)
        return Response(serializer.data)

    def post(self, request, format=None):

        serializer = ProductoSerializer(data=request.data, many=True)
        if serializer.is_valid():
            productos = serializer.save()

            # Sincronización vectorial en segundo plano, en un solo trabajo para todo el lote
            textos = {p.id: generate_vectorizer_text(p) for p in productos}
            sincronizar_vectores_en_segundo_plano({i: t for i, t in textos.items() if t.strip()})

            return Response(serializer.data, status=status.HTTP_201_CREATED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProductoFiltradoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, nombre, format=None):
        # 1. Búsqueda exacta (sin acentos e ignorando mayúsculas/minúsculas)
        productos = Producto.objects.filter(nombre__unaccent__icontains=nombre)
        
        # 2. Si no hay resultados, usar búsqueda vectorial (Langchain + pgvector)
        if not productos.exists():
            vector_store = get_vector_store()
            # Usar búsqueda con score de relevancia (0 a 1, donde más alto es mejor)
            # langchain_postgres retorna la distancia coseno (0 a 2, menor es mejor).
            # Para mayor facilidad, usaremos similarity_search_with_score y filtraremos.
            # Según doc oficial, `similarity_search_with_score` devuelve (Document, distance)
            # y en PGVector por defecto es Cosine Distance. (< 0.5 suele ser bastante parecido).
            resultados_con_score = vector_store.similarity_search_with_score(nombre, k=5)
            
            ids_encontrados = []
            for doc, distance in resultados_con_score:
                # Imprimir en consola para ver qué tan cerca están realmente
                print(f"Buscaste: '{nombre}' -> Encontró: '{doc.page_content}' | Distancia: {distance}")
                
                # threshold ajustado: solo pasar elementos que se parezcan mucho
                if distance < 0.16:
                    if doc.metadata.get("id_django"):
                        ids_encontrados.append(doc.metadata.get("id_django"))
            
            productos = Producto.objects.filter(id__in=ids_encontrados)

        serializer = ProductoSerializer(productos, many=True)
        return Response(serializer.data)
    
    def post(self, request, nombre, format=None):
        lugar = request.data.get('donde')
        try:
            producto = Producto.objects.filter(nombre__unaccent__icontains=nombre, donde=lugar)
        except Producto.DoesNotExist:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        resultados = producto.count()
        if resultados > 1:
            try:
                producto = Producto.objects.filter(nombre__unaccent=nombre, donde=lugar)
            except Producto.DoesNotExist:
                return Response(status=status.HTTP_400_BAD_REQUEST)
        serializer = ProductoSerializer(producto, many=True)
        return Response(serializer.data)


class ProductoFiltradoParametroView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, identifica, format=None):
        try:
            if identifica == 1:
                producto = Producto.objects.filter(semanal=True).order_by('donde', 'nombre', 'id')
            elif identifica == 2:
                producto = Producto.objects.filter(verificar=True).order_by('donde', 'nombre', 'id')
            elif identifica == 3:
                producto = Producto.objects.filter(mensual=True).order_by('donde', 'nombre', 'id')
            elif identifica == 4:
                producto = Producto.objects.filter(donde='Costco').order_by('donde', 'nombre', 'id')
            else:
                return Response(status=status.HTTP_400_BAD_REQUEST)
        except Producto.DoesNotExist:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        serializer = ProductoSerializer(producto, many=True)
        return Response(serializer.data)


class ProductoDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id, format=None):
        try:
            producto = Producto.objects.get(pk=id)
        except Producto.DoesNotExist:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        serializer = ProductoSerializer(producto)
        return Response(serializer.data)

    def put(self, request, id, format=None):
        try:
            producto = Producto.objects.get(pk=id)
        except Producto.DoesNotExist:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        serializer = ProductoSerializer(producto, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        producto_actualizado = serializer.save()

        # Sincronización vectorial en segundo plano. Se pide en cada edición porque el trabajo compara
        # primero con lo guardado: si el vector ya está al día no llama a OpenAI, y si había quedado
        # desfasado (p. ej. por un fallo anterior) esta edición lo corrige.
        texto = generate_vectorizer_text(producto_actualizado)
        if texto.strip():
            sincronizar_vector_en_segundo_plano(producto_actualizado.id, texto)

        return Response(serializer.data)

    def delete(self, request, id, format=None):
        try:
            producto = Producto.objects.get(pk=id)
        except Producto.DoesNotExist:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        
        # Eliminar también de la base de vectores
        try:
            vector_store = get_vector_store()
            vector_store.delete(ids=[str(id)])
        except Exception:
            pass  # Si por alguna razón el vector no estaba o falla, seguimos eliminando
            
        producto.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# interfaz con pendientes
class PendienteListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, format=None):
        pendientes = Pendiente.objects.all()
        serializer = PendienteSerializer(pendientes, many=True)
        return Response(serializer.data)

    def post(self, request, format=None):

        serializer = AgregaPendienteSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PendienteDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id, format=None):
        try:
            pendiente = Pendiente.objects.get(pk=id)
        except Pendiente.DoesNotExist:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        serializer = PendienteSerializer(pendiente)
        return Response(serializer.data)

    def put(self, request, id, format=None):
        try:
            pendiente = Pendiente.objects.get(pk=id)
        except Pendiente.DoesNotExist:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        serializer = PendienteSerializer(pendiente, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, id, format=None):
        try:
            pendiente = Pendiente.objects.get(id=id)
        except Pendiente.DoesNotExist:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        pendiente.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# Interfaz Con lista
class ListaListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, format=None):
        listado = Lista.objects.all().select_related('producto')
        serializer = FinalListaSerializer(listado, many=True)
        return Response(serializer.data)

    def post(self, request, format=None):
        serializer = ListaSerializer(data=request.data, many=isinstance(request.data, list))

        if serializer.is_valid():
            serializer.save()
            return Response(status=status.HTTP_204_NO_CONTENT)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ListaDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id, format=None):
        try:
            listado = Lista.objects.get(pk=id)
        except Lista.DoesNotExist:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        serializer = ListaSerializer(listado)
        return Response(serializer.data)

    def put(self, request, id, format=None):
        try:
            listado = Lista.objects.get(pk=id)
        except Lista.DoesNotExist:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        serializer = ListaSerializer(listado, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, id, format=None):
        try:
            listado = Lista.objects.get(pk=id)
        except Lista.DoesNotExist:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        listado.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ListaDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, format=None):
        services.transferir_lista_a_encargos()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ListaDeleteNoCostcoView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, format=None):
        services.transferir_lista_a_encargos(modo_limpieza='no_costco')
        return Response(status=status.HTTP_204_NO_CONTENT)


class ListaAddEncargadoView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, format=None):
        services.transferir_lista_a_encargos(modo_limpieza='nada')
        return Response(status=status.HTTP_204_NO_CONTENT)

# Local unificar_encargos_walmart removed, now in services.py

class GeneraListaView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        listado = Lista.objects.all().select_related('producto').order_by('producto__donde', 'producto__nombre', 'id')
        serializer = FinalListaSerializer(listado, many=True)
        return Response(serializer.data)


class GeneraEncargadoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        listado = Encargo.objects.all().select_related('producto').order_by('producto__donde', 'producto__nombre', 'id')
        serializer = FinalListaSerializer(listado, many=True)
        return Response(serializer.data)


class EncargadoDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, id, format=None):
        try:
            encargado = Encargo.objects.get(pk=id)
        except Encargo.DoesNotExist:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        encargado.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    
class EncargadoUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, id, format=None):
        try:
            encargado = Encargo.objects.get(pk=id)
        except Encargo.DoesNotExist:
            return Response({'error': 'Encargo no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        cantidad = request.data.get('cantidad')
        unidades = request.data.get('unidades')

        if cantidad is not None:
            try:
                encargado.cantidad = int(cantidad)
            except ValueError:
                return Response({'error': 'Cantidad inválida'}, status=status.HTTP_400_BAD_REQUEST)

        if unidades is not None:
            encargado.unidades = str(unidades)

        encargado.save()
        return Response({'message': 'Encargo actualizado correctamente'}, status=status.HTTP_200_OK)


class GeneraListaWalmartView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        listado = Lista.objects.filter(producto__donde='Walmart').select_related('producto').order_by(
            'producto__donde', 'id')
        serializer = FinalListaSerializer(listado, many=True)
        return Response(serializer.data)




class GeneraComidaView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, comida):
        listado = Comidas.objects.filter(comida__unaccent__icontains=comida).select_related('producto').order_by('producto__donde', 'producto__nombre', 'id')
        serializer = FinalComidaSerializer(listado, many=True)
        return Response(serializer.data)


class ComidasUnicasView(APIView):
    def get(self, request):
        # Obtener comidas únicas
        comidas_unicas = Comidas.objects.values('comida').distinct().order_by('comida')
        serializer = ComidaSerializer(comidas_unicas, many=True)  
        return Response(serializer.data)
    
class AgregaComidaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, format=None):
        if not isinstance(request.data, list):
            return Response({'error': 'Expected a list of items'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for data in request.data:
                comida = Comidas.objects.filter(
                    producto_id=data.get('producto'), 
                    comida=data.get('comida')
                ).first()

                if comida:
                    serializer = InsertaComidaSerializer(comida, data=data)
                else:
                    serializer = InsertaComidaSerializer(data=data)

                if serializer.is_valid():
                    serializer.save()
                else:
                    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        return Response(status=status.HTTP_204_NO_CONTENT)

class BorraComidaView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, comida, id, format=None):
        try:
            comidas = Comidas.objects.get(producto=id, comida=comida)
        except Encargo.DoesNotExist:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        comidas.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


logger = logging.getLogger(__name__)


class VectoresEstadoView(APIView):
    """Cuántos productos tienen su vector desfasado o faltante (lectura pura, sin costo de OpenAI)."""
    permission_classes = [IsAuthenticated]

    def get(self, request, format=None):
        try:
            r = sincronizar_vectores(solo_revisar=True)
        except Exception:
            logger.exception("No se pudo revisar el estado de los vectores")
            return Response({'error': 'vector_db', 'detalle': 'No se pudo consultar la base vectorial.'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({'total': r['total'], 'al_dia': r['al_dia'], 'desfasados': r['desfasados']})


class VectoresSincronizarView(APIView):
    """Sincronización incremental: calcula solo los vectores que faltan o cambiaron."""
    permission_classes = [IsAuthenticated]

    def post(self, request, format=None):
        if not bloqueo_sincronizacion.acquire(blocking=False):
            return Response({'error': 'en_curso', 'detalle': 'Ya hay una sincronización en curso.'},
                            status=status.HTTP_409_CONFLICT)
        try:
            r = sincronizar_vectores()
        except Exception as exc:
            if es_error_de_cuota(exc):
                return Response({
                    'error': 'cuota_openai',
                    'detalle': 'OpenAI rechazó la petición por falta de saldo o cuota agotada (exceso de pago). '
                               'Revisa la facturación en platform.openai.com y vuelve a intentarlo.',
                }, status=status.HTTP_402_PAYMENT_REQUIRED)
            logger.exception("Falló la sincronización de vectores")
            return Response({'error': 'sync', 'detalle': 'No se pudo completar la sincronización.'},
                            status=status.HTTP_502_BAD_GATEWAY)
        finally:
            bloqueo_sincronizacion.release()
        return Response({'sincronizados': r['sincronizados'], 'total': r['total']})


class BorraComidaCompletaView(APIView):
    """Elimina una comida completa: todos los productos que tiene asignados."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, comida, format=None):
        borrados, _ = Comidas.objects.filter(comida=comida).delete()
        if borrados == 0:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ResumenPorCategoriaView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, periodo=None):
        resumen = services.obtener_resumen_gastos(periodo)
        serializer = CategoriaResumenSerializer(resumen, many=True)
        return Response(serializer.data)


class PeriodosView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        periodos = (
            OperacionesHistorico.objects
            .values_list('periodo', flat=True)
            .distinct()
            .order_by('-periodo')
        )

        # Convertimos a formato serializable: [{'periodo': '2024-03'}, ...]
        data = [{'periodo': p} for p in periodos]
        serializer = PeriodoSerializer(data, many=True)
        return Response(serializer.data)

class CrearOperacionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = OperacionSerializerNoId(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data.copy()
            if not data.get('fecha_creacion'):

                mexico_tz = pytz.timezone('America/Mexico_City')
                now_mexico = timezone.now().astimezone(mexico_tz)
                print(now_mexico)
                fecha_creacion_naive = now_mexico.replace(tzinfo=pytz.UTC)
                print(fecha_creacion_naive)
                data = serializer.validated_data.copy()
                data['fecha_creacion'] = fecha_creacion_naive

            Operaciones.objects.create(**data)
            #serializer.save(using='gastos_db')
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OperacionesPorPeriodoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, categoria, periodo=None):

        if not categoria:
            return Response(
                {'detail': 'El parámetro "categoria" es obligatorio.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if periodo:
            queryset = OperacionesHistorico.objects.filter(
                periodo=periodo,
                operacion='Egreso',
                cuenta__endswith='676',
                categoria=categoria
            ).order_by('fecha_operacion')
            serializer = OperacionHistoricoSerializer(queryset, many=True)
        else:
            queryset = Operaciones.objects.filter(
                operacion='Egreso',
                cuenta__endswith='676',
                categoria=categoria
            ).order_by('fecha_creacion')
            serializer = OperacionSerializer(queryset, many=True)

        return Response(serializer.data)

class ActualizarCategoriaView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        id_operacion = request.data.get('id')
        nueva_categoria = request.data.get('categoria')
        periodo = request.data.get('periodo')  # opcional

        if not id_operacion or not nueva_categoria:
            return Response(
                {'detail': 'Los campos "id" y "categoria" son obligatorios.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if periodo:
            try:
                operacion = OperacionesHistorico.objects.get(id=id_operacion, periodo=periodo)
                operacion.categoria = nueva_categoria
                operacion.save()
                return Response({'mensaje': 'Categoría actualizada en histórico'}, status=status.HTTP_200_OK)
            except OperacionesHistorico.DoesNotExist:
                return Response({'detail': 'Operación histórica no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            try:
                operacion = Operaciones.objects.get(id=id_operacion)
                operacion.categoria = nueva_categoria
                operacion.save()
                return Response({'mensaje': 'Categoría actualizada en operaciones'}, status=status.HTTP_200_OK)
            except Operaciones.DoesNotExist:
                return Response({'detail': 'Operación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

class EliminarOperacionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        id_operacion = request.data.get('id')
        periodo = request.data.get('periodo')  # opcional

        if not id_operacion:
            return Response(
                {'detail': 'El campo "id" es obligatorio.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if periodo:
            try:
                operacion = OperacionesHistorico.objects.get(id=id_operacion, periodo=periodo)
                operacion.delete()
                return Response({'mensaje': 'Operación eliminada del histórico'}, status=status.HTTP_200_OK)
            except OperacionesHistorico.DoesNotExist:
                return Response({'detail': 'Operación histórica no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            try:
                operacion = Operaciones.objects.get(id=id_operacion)
                operacion.delete()
                return Response({'mensaje': 'Operación eliminada de operaciones'}, status=status.HTTP_200_OK)
            except Operaciones.DoesNotExist:
                return Response({'detail': 'Operación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)


class DividirOperacionEnMesesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        id_operacion = request.data.get('id')
        meses = request.data.get('meses')

        if not id_operacion or not meses:
            return Response(
                {'detail': 'Los campos "id" y "meses" son obligatorios.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            meses = int(meses)
            if meses < 2:
                return Response({'detail': 'El plazo debe ser de al menos 2 meses para dividir.'},
                                status=status.HTTP_400_BAD_REQUEST)
        except ValueError:
            return Response({'detail': '"meses" debe ser un número entero válido.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            operacion = Operaciones.objects.get(id=id_operacion)
        except Operaciones.DoesNotExist:
            return Response({'detail': 'Operación no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        monto_total = Decimal(operacion.monto)
        monto_mensual = (monto_total / meses).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        # Actualizamos la operación con el nuevo monto mensual
        operacion.monto = monto_mensual
        operacion.save()

        # Insertamos un registro en Meses con todos los datos necesarios
        Meses.objects.create(
            monto=monto_mensual,
            meses=meses - 1,
            establecimiento=operacion.establecimiento,
            operacion=operacion.operacion,
            autorizacion=operacion.autorizacion,
            cuenta=operacion.cuenta,
            tipo=operacion.tipo,
            categoria=operacion.categoria,
            fecha_operacion=operacion.fecha_creacion  # si quieres usar esta fecha
        )

        return Response({'mensaje': f'Operación actualizada. {meses - 1} pagos restantes registrados.'},
                        status=status.HTTP_201_CREATED)