import { Component, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CabeceraComponent } from '../cabecera/cabecera.component';
import { GlobalService } from '../service/global.service';
import { ListaService } from '../service/lista.service';
import { ListaI } from '../interface/lista.interface';
import { Donde } from '../enum/donde.enum';

@Component({
  selector: 'app-checklist',
  templateUrl: './checklist.component.html',
  styleUrls: ['./checklist.component.css'],
  standalone: true,
  imports: [CabeceraComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChecklistComponent implements OnInit {
  private listaService = inject(ListaService);
  private global = inject(GlobalService);

  readonly tiendas = [Donde.WALMART, Donde.COSTCO, Donde.MANDADO, Donde.CARNES];

  private data = signal<ListaI[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  tienda = signal<Donde>(Donde.WALMART);
  private tachados = signal<ReadonlySet<number>>(new Set());

  items = computed(() => this.data().filter(i => i.producto?.donde === this.tienda()));
  total = computed(() => this.items().length);
  hechos = computed(() => this.items().filter(i => this.tachados().has(i.id!)).length);

  async ngOnInit(): Promise<void> {
    await this.global.checkTokens('checklist');
    this.cargar();
  }

  cargar() {
    this.loading.set(true);
    this.error.set(null);
    this.listaService.encargado$.subscribe({
      next: (response) => {
        this.data.set(response);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los encargos.');
        this.loading.set(false);
      }
    });
  }

  cambiarTienda(tienda: Donde) {
    this.tienda.set(tienda);
  }

  estaTachado(id: number): boolean {
    return this.tachados().has(id);
  }

  tachar(id: number) {
    this.tachados.update(actual => {
      const nuevo = new Set(actual);
      if (!nuevo.delete(id)) {
        nuevo.add(id);
      }
      return nuevo;
    });
  }
}
