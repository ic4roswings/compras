import os
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings
from langchain_postgres.vectorstores import PGVector
import re

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
def get_vector_store():
    # Retorna la instancia de PGVector conectada a la coleccion de productos
    return PGVector(
        embeddings=embeddings,
        collection_name="productos",
        connection=VECTOR_DB_URL,
        use_jsonb=True,
    )

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
