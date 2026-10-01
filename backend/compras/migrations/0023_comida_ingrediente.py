import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('compras', '0022_base_comida'),
    ]

    operations = [
        migrations.CreateModel(
            name='Comida',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=50, unique=True)),
                ('tipo', models.PositiveSmallIntegerField(choices=[(1, 'Entre semana'), (2, 'Fin de semana')], default=1)),
                ('base', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='comidas_base', to='compras.basecomida')),
            ],
        ),
        migrations.CreateModel(
            name='ComidaIngrediente',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cantidad', models.IntegerField()),
                ('unidades', models.CharField(default='', max_length=50)),
                ('comida', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ingredientes', to='compras.comida')),
                ('producto', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ingredientes_comida', to='compras.producto')),
            ],
        ),
        migrations.AddConstraint(
            model_name='comidaingrediente',
            constraint=models.UniqueConstraint(fields=('comida', 'producto'), name='comida_producto_unico'),
        ),
        # HistorialComida: el texto pasa a `nombre` (snapshot) y `comida` es ahora la FK al encabezado
        migrations.RenameField(
            model_name='historialcomida',
            old_name='comida',
            new_name='nombre',
        ),
        migrations.AddField(
            model_name='historialcomida',
            name='comida',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='historial', to='compras.comida'),
        ),
    ]
