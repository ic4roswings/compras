from django.core.management.base import BaseCommand, CommandError
from compras.vector_service import es_error_de_cuota, sincronizar_vectores


class Command(BaseCommand):
    help = (
        'Sincroniza los productos hacia la base de datos de vectores (pgvector). '
        'Por defecto solo calcula los que faltan o cambiaron.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--forzar', action='store_true',
            help='Recalcula el embedding de todos los productos, aunque ya estén al día',
        )
        parser.add_argument(
            '--solo-revisar', action='store_true',
            help='Solo informa cuántos productos están desfasados; no calcula ni escribe nada',
        )

    def handle(self, *args, **opciones):
        self.stdout.write(self.style.NOTICE('Iniciando sincronización de vectores...'))
        try:
            r = sincronizar_vectores(
                forzar=opciones['forzar'],
                solo_revisar=opciones['solo_revisar'],
                avisar=self.stdout.write,
            )
        except Exception as exc:
            if es_error_de_cuota(exc):
                raise CommandError(
                    'OpenAI rechazó la petición por falta de saldo o cuota agotada (exceso de pago). '
                    'Revisa la facturación en platform.openai.com y vuelve a correr el comando.'
                )
            raise

        self.stdout.write(f'Encontrados {r["total"]} productos.')
        self.stdout.write(f'Al día: {r["al_dia"]} | Desfasados o faltantes: {r["desfasados"]}')
        if opciones['solo_revisar']:
            self.stdout.write(self.style.WARNING('Modo solo revisar: no se escribió nada.'))
        else:
            self.stdout.write(self.style.SUCCESS('¡Sincronización completada con éxito!'))
