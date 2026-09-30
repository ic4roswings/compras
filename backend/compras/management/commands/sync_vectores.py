from django.core.management.base import BaseCommand
from langchain_core.documents import Document
from compras.models import Producto
from compras.vector_service import get_vector_store, generate_vectorizer_text

class Command(BaseCommand):
    help = 'Sincroniza los productos existentes hacia la base de datos de vectores (pgvector)'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.NOTICE('Iniciando sincronización de vectores...'))
        
        vector_store = get_vector_store()
        
        productos = Producto.objects.all()
        total = productos.count()
        self.stdout.write(f'Encontrados {total} productos para procesar.')
        
        documents_to_add = []
        lote_size = 500
        procesados = 0
        
        for producto in productos.iterator():
            texto_final = generate_vectorizer_text(producto)
            
            # Solo vectorizamos si hay texto
            if texto_final.strip():
                # Documento de Langchain: Contenido a vectorizar (Texto) + Metadatos
                doc = Document(
                    page_content=texto_final,
                    metadata={"id_django": producto.id}
                )
                documents_to_add.append(doc)
            
            # Guardamos por lotes para no saturar la API o la RAM
            if len(documents_to_add) >= lote_size:
                self.stdout.write(f'Generando embeddings y guardando lote de {len(documents_to_add)} productos...')
                vector_store.add_documents(documents_to_add, ids=[str(d.metadata["id_django"]) for d in documents_to_add])
                procesados += len(documents_to_add)
                documents_to_add = []
                self.stdout.write(self.style.SUCCESS(f'Progreso: {procesados}/{total}'))
        
        # Guardar el resto si quedaron en el buffer
        if documents_to_add:
            self.stdout.write(f'Generando embeddings y guardando último lote de {len(documents_to_add)} productos...')
            vector_store.add_documents(documents_to_add, ids=[str(d.metadata["id_django"]) for d in documents_to_add])
            procesados += len(documents_to_add)
            self.stdout.write(self.style.SUCCESS(f'Progreso: {procesados}/{total}'))

        self.stdout.write(self.style.SUCCESS('¡Sincronización completada con éxito!'))
