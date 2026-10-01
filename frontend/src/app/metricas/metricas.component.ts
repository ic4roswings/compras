import { Component, OnInit, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faSearch, faTimes, faFilter, faChevronDown, faChartLine } from '@fortawesome/free-solid-svg-icons';
import { GlobalService } from '../service/global.service';
import { MetricasService } from '../service/metricas.service';
import { MetricaComida, MetricaProducto } from '../interface/metricas.interface';
import { CabeceraComponent } from '../cabecera/cabecera.component';

type Vista = 'productos' | 'comidas';

@Component({
  selector: 'app-metricas',
  templateUrl: './metricas.component.html',
  styleUrls: ['./metricas.component.css'],
  standalone: true,
  imports: [CabeceraComponent, FontAwesomeModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MetricasComponent implements OnInit {
  private global = inject(GlobalService);
  private metricas = inject(MetricasService);

  // Icons
  faSearch = faSearch;
  faTimes = faTimes;
  faFilter = faFilter;
  faChevronDown = faChevronDown;
  faChartLine = faChartLine;

  vista = signal<Vista>('productos');
  busqueda = signal('');
  productos = signal<MetricaProducto[]>([]);
  comidas = signal<MetricaComida[]>([]);
  error = signal<string | null>(null);

  private normaliza = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  productosFiltrados = computed(() => {
    const q = this.normaliza(this.busqueda());
    return q ? this.productos().filter(p => this.normaliza(p.nombre).includes(q)) : this.productos();
  });

  comidasFiltradas = computed(() => {
    const q = this.normaliza(this.busqueda());
    return q ? this.comidas().filter(c => this.normaliza(c.comida).includes(q)) : this.comidas();
  });

  async ngOnInit(): Promise<void> {
    await this.global.checkTokens('metricas');
    this.metricas.productos$().subscribe({
      next: r => this.productos.set(r),
      error: () => this.error.set('Error cargando las métricas de productos.')
    });
    this.metricas.comidas$().subscribe({
      next: r => this.comidas.set(r),
      error: () => this.error.set('Error cargando las métricas de comidas.')
    });
  }

  cambiaVista(vista: Vista) {
    this.vista.set(vista);
    this.busqueda.set('');
  }
}
