import { Component, ChangeDetectionStrategy, ElementRef, EventEmitter, Output, ViewChild, computed, inject, input, signal } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faSearch, faTimes, faTrashAlt, faUtensils } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import { ComidasService } from '../service/comidas.service';
import { ProductoI } from '../interface/producto.interface';

declare var bootstrap: any;

interface ItemComida {
  producto: ProductoI;
  cantidad: number;
  unidades: string;
}

const normaliza = (texto: string) =>
  (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

@Component({
  selector: 'app-nueva-comida',
  templateUrl: './nueva-comida.component.html',
  styleUrls: ['./nueva-comida.component.css'],
  standalone: true,
  imports: [FontAwesomeModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NuevaComidaComponent {
  private comidasService = inject(ComidasService);

  @ViewChild('comidaModal') modalElement!: ElementRef;
  @Output() saved = new EventEmitter<string>();

  // Catálogo ya cargado en la pantalla de productos
  productos = input<ProductoI[]>([]);

  faSearch = faSearch;
  faTimes = faTimes;
  faTrashAlt = faTrashAlt;
  faUtensils = faUtensils;

  private modal: any;

  nombre = signal('');
  busqueda = signal('');
  items = signal<ItemComida[]>([]);
  comidasExistentes = signal<string[]>([]);
  guardando = signal(false);
  // null = no tocar el tipo (una comida existente conserva el suyo; una nueva queda entre semana)
  tipo = signal<number | null>(null);
  // Texto libre: se elige una base del catálogo o se escribe una nueva (vacío = no tocar la base)
  base = signal('');
  basesExistentes = signal<string[]>([]);

  // Bases ya usadas que coinciden con lo escrito (todas si el campo está vacío)
  basesVisibles = computed(() => {
    const q = normaliza(this.base());
    return q ? this.basesExistentes().filter(b => normaliza(b).includes(q)) : this.basesExistentes();
  });

  esBaseElegida(base: string): boolean {
    return normaliza(base) === normaliza(this.base());
  }

  // Clic en una base existente: la elige; otro clic sobre la misma la quita
  elegirBase(base: string) {
    this.base.set(this.esBaseElegida(base) ? '' : base);
  }

  // Resultados de la búsqueda: sin acentos, sin repetir los ya agregados
  sugerencias = computed(() => {
    const q = normaliza(this.busqueda().trim());
    if (!q) {
      return [];
    }
    const agregados = new Set(this.items().map(i => i.producto.id));
    return this.productos()
      .filter(p => !agregados.has(p.id) && normaliza(p.nombre).includes(q))
      .slice(0, 8);
  });

  puedeGuardar = computed(() =>
    this.nombre().trim().length > 0 &&
    this.items().length > 0 &&
    this.items().every(i => this.cantidadValida(i.cantidad))
  );

  open() {
    this.nombre.set('');
    this.busqueda.set('');
    this.items.set([]);
    this.guardando.set(false);
    this.tipo.set(null);
    this.base.set('');
    this.comidasService.bases$().subscribe({
      next: (data) => this.basesExistentes.set((data || []).map(b => b.nombre)),
      error: () => this.basesExistentes.set([])
    });

    this.comidasService.obtenerComidasUnicas().subscribe({
      next: (data: { comida: string }[]) => this.comidasExistentes.set((data || []).map(c => c.comida)),
      error: () => this.comidasExistentes.set([])
    });

    if (!this.modal) {
      this.modal = new bootstrap.Modal(this.modalElement.nativeElement);
    }
    this.modal.show();
  }

  close() {
    this.modal?.hide();
  }

  cantidadValida(cantidad: number): boolean {
    return Number.isInteger(cantidad) && cantidad >= 1;
  }

  agregar(producto: ProductoI) {
    this.items.update(lista => [...lista, {
      producto,
      cantidad: Math.max(1, Math.round(producto.cantidad || 1)),
      unidades: producto.unidades || 'PZ'
    }]);
    this.busqueda.set('');
  }

  quitar(indice: number) {
    this.items.update(lista => lista.filter((_, i) => i !== indice));
  }

  cambiaCantidad(indice: number, valor: string) {
    this.items.update(lista => lista.map((item, i) => i === indice ? { ...item, cantidad: Number(valor) } : item));
  }

  cambiaUnidades(indice: number, valor: string) {
    this.items.update(lista => lista.map((item, i) => i === indice ? { ...item, unidades: valor } : item));
  }

  guardar() {
    if (!this.puedeGuardar() || this.guardando()) {
      return;
    }
    this.guardando.set(true);

    const comida = this.nombre().trim();
    const payload = this.items().map(i => ({
      producto: i.producto.id!,
      cantidad: i.cantidad,
      unidades: i.unidades
    }));

    this.comidasService.agregaProductosAComida(comida, payload, this.tipo(), this.base().trim()).subscribe({
      next: () => {
        this.guardando.set(false);
        Swal.fire({
          title: 'Éxito',
          text: 'Se agregó correctamente',
          timer: 500,
          icon: 'success',
          showConfirmButton: false
        });
        this.close();
        this.saved.emit(comida);
      },
      error: () => {
        this.guardando.set(false);
        Swal.fire('Error', 'No se pudo guardar la comida', 'error');
      }
    });
  }
}
