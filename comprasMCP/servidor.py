import json
import requests
from mcp.server.fastmcp import FastMCP
import psycopg2
from dotenv import load_dotenv
import os

# Cargar las variables de entorno del archivo .env
load_dotenv()

# Acceder a las variables
db_host = os.getenv("DB_HOST")
db_port = os.getenv("DB_PORT")
db_user = os.getenv("DB_USER")
db_password = os.getenv("DB_PASSWORD")
db_name = os.getenv("DB_NAME")
# Inicializamos FastMCP
mcp = FastMCP("Compras-API")

# Configuración de red local
BASE_URL = os.getenv("SERV_URL")
ENDPOINTS = {
    "productos": f"{BASE_URL}/productos/",
    "lista": f"{BASE_URL}/lista/",
    "dameLista": f"{BASE_URL}/damelista/",
}

def get_headers():
    """
    Obtiene el token de acceso válido de Postgres. 
    Si no es válido o no existe, lanza una excepción para que el MCP informe el error.
    """
    conn = None
    try:
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            database=db_name,
            user=db_user,
            password=db_password,
            connect_timeout=3
        )
        
        cur = conn.cursor()
        
        # Query Singleton: Traemos el token solo si la expiración es mayor a "ahora"
        query = """
            SELECT access_token 
            FROM current_auth 
            LIMIT 1;
        """
        
        cur.execute(query)
        resultado = cur.fetchone()
        
        cur.close()
        
        if resultado and resultado[0]:
            token = resultado[0]
            return {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {token}'
            }
        else:
            # Si llegamos aquí, n8n no ha renovado el token o el login falló
            raise Exception("Token de acceso expirado o no encontrado en DB.")

    except psycopg2.Error as e:
        print(f"Error de base de datos: {e}")
        raise Exception("No se pudo conectar a la base de datos de autenticación.")
    
    finally:
        if conn:
            conn.close()

@mcp.tool()
def buscar_producto_catalogo(nombre: str) -> str:
    """
    Busca productos en el catálogo. 
    Retorna una lista de productos con su ID, nombre, unidad y tienda (donde).
    """
    url = f"{ENDPOINTS['productos']}{nombre.capitalize()}"
    try:
        response = requests.get(url, headers=get_headers(), timeout=4)
        if response.status_code == 200:
            data = response.json() # Esto recibe el array: [{"id": 339, ...}, ...]
            if not data:
                return f"No se encontró nada para '{nombre}'."
            
            # Formateamos para que la IA entienda las opciones
            opciones = [f"ID: {p['id']} | {p['nombre']} unidad: {p['unidades']} en {p['donde']} " for p in data]
            return "Productos encontrados:\n" + "\n".join(opciones)
        return f"Error en API: {response.status_code}"
    except Exception as e:
        return f"Error de conexión: {str(e)}"

@mcp.tool()
def crear_y_agregar_producto(nombre: str, donde: str = "Walmart", unidades: str = "PZ") -> str:
    """
    Crea un nuevo producto en el catálogo y lo añade a la lista de compras.
    Úsalo cuando el producto no exista en la búsqueda.
    """
    # 1. Crear en catálogo (POST)
    payload_crear = {
        "nombre": nombre.capitalize(),
        "donde": donde.capitalize(),
        "cantidad": 1,
        "unidades": unidades,
        "semanal": False,
        "mensual": False,
        "verificar": False
    }
    
    try:
        # Tu API recibe el objeto directo o en lista según el código viejo
        response_crear = requests.post(ENDPOINTS['productos'], 
                                     headers=get_headers(), 
                                     json=[payload_crear], # Enviamos como lista según tu código
                                     timeout=4)
        
        if response_crear.status_code in [200, 201]:
            # La respuesta es el objeto creado: {"id": 136, "nombre": ...}
            # Si tu API devuelve una lista del objeto creado, usamos data[0]
            data = response_crear.json()
            new_id = data[0]['id'] if isinstance(data, list) else data['id']
            
            # 2. Agregar a la lista de compras
            return agregar_a_lista_existente(new_id, 1, unidades)
            
        return f"No se pudo crear: {response_crear.text}"
    except Exception as e:
        return f"Error en creación: {str(e)}"

@mcp.tool()
def agregar_a_lista_existente(producto_id: int, cantidad: float = 1.0, unidades: str = "PZ") -> str:
    """Añade un producto por su ID a la lista de compras final."""
    payload_lista = [{
        "producto": producto_id,
        "cantidad": cantidad,
        "unidades": unidades
    }]
    
    response = requests.post(ENDPOINTS['lista'], headers=get_headers(), json=payload_lista, timeout=4)
    
    if response.status_code in [200, 201, 204]:
        return "Producto añadido con éxito a la lista de compras."
    return f"Error al añadir a la lista: {response.status_code}"

@mcp.tool()
def ver_lista_compras(tienda: str = None) -> str:
    """
    Obtiene la lista actual de compras desde el servidor.
    Permite filtrar por tienda si se proporciona el nombre.
    """
   
    try:
        headers = get_headers() 
    except Exception as e:
        return f"Error al obtener credenciales: {str(e)}"

    try:
        response = requests.get(ENDPOINTS['dameLista'], headers=headers, timeout=7)
        response.raise_for_status()
        data = response.json()

        if not data:
            return "La lista de compras está actualmente vacía."

        if tienda:
            data = [item for item in data if tienda.lower() in item['producto']['donde'].lower()]
            if not data:
                return f"No hay productos pendientes para la tienda {tienda}."

        lineas = []
        for item in data:
            # Extraemos nombre y tienda del objeto anidado 'producto'
            p = item['producto']
            # EXTRAEMOS cantidad y unidades del objeto PRINCIPAL (el que está en la lista)
            cantidad = item['cantidad']
            unidades = item['unidades']
            
            lineas.append(f"- {cantidad} {unidades} de {p['nombre']} en {p['donde']}")
        
        return "\n".join(lineas)

    except requests.exceptions.Timeout:
        return "Error: El servidor tardó demasiado en responder."
    except Exception as e:
        return f"Error técnico al consultar la lista: {str(e)}"

if __name__ == "__main__":
    mcp.run(transport='sse')

