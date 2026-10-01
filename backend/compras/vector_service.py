import logging
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache

from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_postgres.vectorstores import PGVector

logger = logging.getLogger(__name__)

# Cargamos las variables de entorno desde el .env principal del proyecto
# Asumiendo que .env está en la raíz de compras
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(dotenv_path)

VECTOR_DB_URL = os.environ.get("VECTOR_DB_URL", "")
if not VECTOR_DB_URL and "PGVECTOR" not in os.environ:
    # Usar variable por defecto si no existe pero preferiblemente fallar o avisar
    pass

# Inicializar modelo de OpenAI con el modelo acordado
embeddings = OpenAIEmbeddings(
    model="text-embedding-ada-002",
    api_key=os.environ.get("OPENAI_API_KEY", "")
)

# Inicializar nuestro store vectorial
@lru_cache(maxsize=1)
def get_vector_store():
    # Una sola instancia por proceso: reutiliza el motor y las conexiones en lugar de crear
    # un PGVector (y su preparación inicial) en cada petición.
    # pool_pre_ping revalida la conexión antes de usarla, por si la base se reinició.
    return PGVector(
        embeddings=embeddings,
        collection_name="productos",
        connection=VECTOR_DB_URL,
        use_jsonb=True,
        engine_args={"pool_pre_ping": True, "pool_recycle": 1800},
    )


# Un solo hilo en cola: las sincronizaciones de un mismo producto se aplican en el orden
# en que se pidieron (con más hilos, dos ediciones seguidas podrían terminar al revés).
_ejecutor_vectores = ThreadPoolExecutor(max_workers=1, thread_name_prefix="vector-sync")


INTENTOS_SINCRONIZACION = 3

# Códigos con los que OpenAI avisa que el problema es de dinero, no de saturación pasajera
CODIGOS_SIN_SALDO = ("insufficient_quota", "billing_hard_limit_reached", "billing_not_active")


def es_error_de_cuota(exc):
    """True si OpenAI rechazó la petición por falta de saldo / cuota agotada ("exceso de pago").
    Reintentar no sirve: hay que recargar saldo o subir el límite de facturación."""
    visto = set()
    while exc is not None and id(exc) not in visto:
        visto.add(id(exc))
        if getattr(exc, "code", None) in CODIGOS_SIN_SALDO:
            return True
        exc = exc.__cause__ or exc.__context__
    return False


def _sincroniza_vectores(textos):
    """Deja al día los vectores de {id_producto: texto}. Es idempotente: los que ya tienen ese texto
    no se tocan (no pagan embedding), el resto se calcula en una sola llamada, y si falla
    reintenta con espera creciente."""
    ids_txt = ", ".join(str(i) for i in list(textos)[:10]) + ("…" if len(textos) > 10 else "")
    for intento in range(1, INTENTOS_SINCRONIZACION + 1):
        try:
            almacen = get_vector_store()
            guardados = {int(d.id): d.page_content for d in almacen.get_by_ids([str(i) for i in textos])}
            pendientes = {i: t for i, t in textos.items() if guardados.get(i) != t}
            if pendientes:
                almacen.add_documents(
                    [Document(page_content=t, metadata={"id_django": i}) for i, t in pendientes.items()],
                    ids=[str(i) for i in pendientes],
                )
            return
        except Exception as exc:
            if es_error_de_cuota(exc):
                # Reintentar no sirve. El navbar mostrará RESYNC para sincronizar cuando haya saldo.
                logger.error("OpenAI rechazó el embedding de los productos %s por falta de saldo o cuota "
                             "(exceso de pago); quedan desfasados hasta el próximo RESYNC", ids_txt)
                return
            if intento == INTENTOS_SINCRONIZACION:
                # La respuesta al usuario ya salió: solo queda dejar rastro. El desfase se corrige
                # solo en la siguiente edición del producto o con RESYNC / `manage.py sync_vectores`.
                logger.exception("No se pudo sincronizar el vector de los productos %s tras %s intentos",
                                 ids_txt, INTENTOS_SINCRONIZACION)
                return
            logger.warning("Falló la sincronización del vector de los productos %s (intento %s); se reintenta",
                           ids_txt, intento)
            time.sleep(2 ** intento)


def sincronizar_vectores_en_segundo_plano(textos):
    """Asegura los vectores de {id_producto: texto} sin hacer esperar la respuesta HTTP.
    Un solo trabajo para todo el lote: una lectura y, si hace falta, una llamada de embeddings."""
    if textos:
        _ejecutor_vectores.submit(_sincroniza_vectores, dict(textos))


def sincronizar_vector_en_segundo_plano(producto_id, texto):
    """Asegura el vector de un producto. Se puede llamar en cada edición: si ya está al día,
    el costo es una lectura."""
    sincronizar_vectores_en_segundo_plano({producto_id: texto})

def extract_text_from_walmart_url(url):
    """
    Extrae la descripción de una URL típica de Walmart.
    Ej: /ip/galletas-chips-ahoy-con-chispas-sabor-chocolate-257-6-g/00762221057622 -> "galletas chips ahoy con chispas sabor chocolate 257 6 g"
    """
    if not url:
         return ""
         
    # Expresión regular para capturar lo que está entre /ip/ y los últimos /numeros
    match = re.search(r'/ip/([^/]+)/\d+', url)
    if match:
        raw_text = match.group(1)
        # Reemplazamos guiones por espacios
        clean_text = raw_text.replace('-', ' ')
        return clean_text
    
    return ""

def generate_vectorizer_text(producto):
    """
    Genera el texto final que será vectorizado.
    Si tiene URL de walmart válida, une el nombre y la url.
    De lo contrario, usa solo el nombre.
    """
    nombre = producto.nombre or ""
    url_text = extract_text_from_walmart_url(producto.URL)
    
    if url_text:
        return f"{nombre} {url_text}"
    return nombre


# Evita que dos sincronizaciones completas corran a la vez dentro del mismo proceso
bloqueo_sincronizacion = threading.Lock()

LOTE_SINCRONIZACION = 500


def sincronizar_vectores(forzar=False, solo_revisar=False, avisar=None):
    """Compara cada producto con su vector y, salvo en modo solo_revisar, recalcula los que faltan
    o cambiaron (con forzar=True, todos). Revisar es una lectura pura: no cuesta embeddings.

    Devuelve {"total", "al_dia", "desfasados", "sincronizados"}. Si OpenAI falla (p. ej. por falta
    de saldo) la excepción sube al llamador; lo que ya se guardó en lotes anteriores se conserva.
    """
    from .models import Producto  # import tardío: este módulo se carga antes de que estén listos los modelos

    avisar = avisar or (lambda mensaje: None)
    almacen = get_vector_store()
    total = Producto.objects.count()
    resultado = {"total": total, "al_dia": 0, "desfasados": 0, "sincronizados": 0}

    def procesa(productos):
        textos = {}
        for producto in productos:
            texto = generate_vectorizer_text(producto)
            if texto.strip():
                textos[producto.id] = texto

        if forzar:
            pendientes = textos
        else:
            guardados = {int(d.id): d.page_content for d in almacen.get_by_ids([str(i) for i in textos])}
            pendientes = {i: t for i, t in textos.items() if guardados.get(i) != t}

        resultado["al_dia"] += len(textos) - len(pendientes)
        resultado["desfasados"] += len(pendientes)

        if pendientes and not solo_revisar:
            avisar(f"Generando embeddings y guardando {len(pendientes)} productos...")
            almacen.add_documents(
                [Document(page_content=t, metadata={"id_django": i}) for i, t in pendientes.items()],
                ids=[str(i) for i in pendientes],
            )
            resultado["sincronizados"] += len(pendientes)

    lote, revisados = [], 0
    for producto in Producto.objects.all().iterator():
        lote.append(producto)
        if len(lote) >= LOTE_SINCRONIZACION:
            procesa(lote)
            revisados += len(lote)
            lote = []
            avisar(f"Progreso: {revisados}/{total}")
    if lote:
        procesa(lote)
        revisados += len(lote)
        avisar(f"Progreso: {revisados}/{total}")

    return resultado
