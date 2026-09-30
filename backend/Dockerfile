# Utiliza la imagen oficial de Python 3.12 como base
# docker run -d --name compras_python --net red_python --ip 172.18.0.2 -p 8000:8000 --restart unless-stopped compras
FROM python:3.12-slim

# Establece el directorio de trabajo en el contenedor
WORKDIR /app

# Copia el archivo de requisitos al directorio de trabajo
COPY requirements.txt .

# Instala los paquetes requeridos
RUN pip install --no-cache-dir -r requirements.txt

# Copia el código de tu proyecto al directorio de trabajo
COPY . .

# Expone el puerto en el que se ejecutará Gunicorn (cambia 8000 si es necesario)
EXPOSE 8000

# Inicia Gunicorn (cambia compras.wsgi si es necesario)
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:8000", "compras.wsgi:application"]
