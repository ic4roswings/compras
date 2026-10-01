import { Component, OnInit, ViewChild, ChangeDetectionStrategy, inject, signal, computed, ElementRef, viewChild } from '@angular/core';

import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { DataState } from '../enum/data-state.enum';
import { GlobalService } from '../service/global.service';
import { ComidasService } from '../service/comidas.service';
import { SelectorBaseComponent } from '../selector-comida/selector-base.component';
import { SelectorTipoComponent } from '../selector-comida/selector-tipo.component';
import { MetricasService } from '../service/metricas.service';
import { SugerenciaComida } from '../interface/metricas.interface';
import { Comidas } from '../interface/comidas.interface';
import { CabeceraComponent } from '../cabecera/cabecera.component';
import Swal from 'sweetalert2';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus, faTrashAlt, faTrash, faEdit, faCartPlus, faUtensils, faTimes, faChevronDown, faBars, faBolt, faSearch, faLightbulb, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import { AgregarComidasComponent } from '../agregar-comidas/agregar-comidas.component';
import { NuevaComidaComponent } from '../nueva-comida/nueva-comida.component';
import { ProductoService } from '../service/producto.service';
import { ProductoI } from '../interface/producto.interface';
import { Donde } from '../enum/donde.enum';
declare var bootstrap: any;

@Component({
  selector: 'app-comidas',
  templateUrl: './comidas.component.html',
  styleUrls: ['./comidas.component.css'],
  standalone: true,
  imports: [RouterModule, CabeceraComponent, FontAwesomeModule, AgregarComidasComponent, NuevaComidaComponent, SelectorBaseComponent, SelectorTipoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComidasComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private comidasService = inject(ComidasService);
  private metricasService = inject(MetricasService);
  private productoService = inject(ProductoService);
  private global = inject(GlobalService);
  private router = inject(Router);

  // Icons
  faChevronDown = faChevronDown;
  faBars = faBars;
  faPlus = faPlus;
  faTrashAlt = faTrashAlt;
  faTrash = faTrash;
  faEdit = faEdit;
  faCartPlus = faCartPlus;
  faUtensils = faUtensils;
  faTimes = faTimes;
  faBolt = faBolt;
  faSearch = faSearch;
  faLightbulb = faLightbulb;
  faSyncAlt = faSyncAlt;

  searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  dropdownBtn = viewChild<ElementRef<HTMLButtonElement>>('dropdownBtn');
  mealModal = viewChild(AgregarComidasComponent);
  nuevaComidaModal = viewChild(NuevaComidaComponent);

  readonly DataState = DataState;

  // Signals State
  data = signal<Comidas[] | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  currentMeal = signal<string>('');
  comidasUnicas = signal<any>(null);
  sugerencias = signal<SugerenciaComida[]>([]);
  bases = signal<string[]>([]);
  private vistas: string[] = [];
  searchTerm = signal<string>('');
  activeIndex = signal<number>(-1);
  catalogo = signal<ProductoI[]>([]);

  // Computed state for the UI
  filteredComidas = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const list = this.comidasUnicas();
    if (!list) return [];
    if (!term) return list;
    return list.filter((c: any) => c.comida.toLowerCase().includes(term));
  });

  appState = computed(() => {
    if (this.loading()) return { dataState: DataState.LOADING_STATE };
    if (this.error()) return { dataState: DataState.ERROR_STATE, error: this.error() };
    return { dataState: DataState.LOADED_STATE, appData: this.data() || [] };
  });

  // Constants
  todos = Donde.ALL;
  carnes = Donde.CARNES;
  walmart = Donde.WALMART;
  costco = Donde.COSTCO;
  mandado = Donde.MANDADO;

  async ngOnInit(): Promise<void> {
    const mealParam = this.route.snapshot.paramMap.get('comida');
    if (mealParam) {
      this.obtenComidas(mealParam);
    } else {
      await this.global.checkTokens('comidas');
      this.data.set([]);
    }
    this.cargarComidasUnicas();
    this.cargarSugerencias();
    this.cargarBases();
  }

  // El catálogo solo se pide la primera vez que se abre el modal de comida nueva
  nuevaComida(): void {
    this.nuevaComidaModal()?.open();
    if (this.catalogo().length === 0) {
      this.productoService.productos$.subscribe({
        next: (productos) => this.catalogo.set(productos),
        error: () => Swal.fire('Error', 'No se pudo cargar el catálogo de productos.', 'error')
      });
    }
  }

  // Tras guardar: refresca la lista de comidas y muestra la que se acaba de crear o actualizar
  onNuevaComidaGuardada(comida: string): void {
    this.cargarComidasUnicas();
    this.cargarSugerencias();
    this.cargarBases();
    this.obtenComidas(comida);
  }

  // Comidas que no se han hecho recientemente; si falla simplemente no se muestran
  // Con `otras` pide 2 distintas a las que ya se vieron; sin él reinicia las exclusiones
  cargarSugerencias(otras = false): void {
    const vistas = otras ? [...this.vistas, ...this.sugerencias().map(s => s.comida)] : [];
    this.metricasService.sugerencias$(vistas).subscribe({
      next: (data) => {
        this.vistas = vistas;
        this.sugerencias.set(data);
      },
      error: (err) => console.error('Error al cargar las sugerencias:', err)
    });
  }

  // Tipo de la comida seleccionada (1 entre semana, 2 fin de semana); todas sus filas lo comparten
  baseActual = computed(() => this.data()?.[0]?.base ?? '');

  cargarBases(): void {
    this.comidasService.bases$().subscribe({
      next: (data) => this.bases.set((data || []).map(b => b.nombre)),
      error: (err) => console.error('Error al cargar las bases:', err)
    });
  }

  cambiaBase(valor: string): void {
    const comida = this.currentMeal();
    const base = valor.trim();
    if (!comida || base === this.baseActual()) return;
    this.comidasService.cambiaBaseComida(comida, base).subscribe({
      next: () => {
        this.data.update(filas => (filas || []).map(f => ({ ...f, base: base || null })));
        this.cargarBases();
        this.cargarSugerencias();
      },
      error: () => Swal.fire('Error', 'No se pudo cambiar la base', 'error')
    });
  }

  tipoActual = computed(() => this.data()?.[0]?.tipo ?? 1);

  cambiaTipo(tipo: number): void {
    const comida = this.currentMeal();
    if (!comida) return;
    this.comidasService.cambiaTipoComida(comida, tipo).subscribe({
      next: () => {
        this.data.update(filas => (filas || []).map(f => ({ ...f, tipo })));
        this.cargarSugerencias();
      },
      error: () => Swal.fire('Error', 'No se pudo cambiar el tipo', 'error')
    });
  }

  cargarComidasUnicas(): void {
    this.comidasService.obtenerComidasUnicas().subscribe({
      next: (data) => this.comidasUnicas.set(data),
      error: (err) => console.error('Error al cargar las comidas:', err)
    });
  }

  onSearchInput(event: Event): void {
    const element = event.target as HTMLInputElement;
    this.searchTerm.set(element.value);
    this.activeIndex.set(-1); // Reset selection on type
  }

  resetSearch(): void {
    this.searchTerm.set('');
    this.activeIndex.set(-1);

    setTimeout(() => {
      this.searchInput()?.nativeElement.focus();
    }, 100);
  }

  onKeyDown(event: KeyboardEvent): void {
    const items = this.filteredComidas();
    if (!items.length) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.update(idx => (idx + 1) % items.length);
        this.scrollToActive();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update(idx => (idx - 1 + items.length) % items.length);
        this.scrollToActive();
        break;
      case 'Enter':
        event.preventDefault();
        if (this.activeIndex() >= 0) {
          const selectedMeal = items[this.activeIndex()].comida;
          this.obtenComidas(selectedMeal);

          // Close the dropdown using Bootstrap API
          const btn = this.dropdownBtn()?.nativeElement;
          if (btn) {
            const dropdown = bootstrap.Dropdown.getOrCreateInstance(btn);
            dropdown.hide();
          }
        }
        break;
      case 'Escape':
        this.searchTerm.set('');
        break;
    }
  }

  private scrollToActive(): void {
    setTimeout(() => {
      const activeElement = document.querySelector('.dropdown-item.active-keyboard');
      activeElement?.scrollIntoView({ block: 'nearest' });
    });
  }

  obtenComidas(filtro: string): void {
    this.currentMeal.set(filtro);
    this.data.set(null); // Reset data to ensure spinner shows
    this.loading.set(true);
    this.comidasService.comidas$(filtro).subscribe({
      next: (response) => {
        // Minimal delay to prevent flicker on fast connections and ensure spinner shows
        setTimeout(() => {
          this.data.set(response);
          this.loading.set(false);
        }, 300);
      },
      error: (err) => {
        this.error.set('Error cargando las comidas.');
        this.loading.set(false);
      }
    });
  }

  agregaComidas() {
    const currentData = this.data();
    if (!currentData) return;

    this.loading.set(true);
    this.comidasService.agregaComidas(currentData).subscribe({
      next: (response) => {
        Swal.fire({
          title: 'Éxito',
          text: 'Se agregó correctamente',
          timer: 500,
          icon: 'success',
          showConfirmButton: false
        });
        const nombre = currentData[0]?.comida;
        if (nombre) {
          this.comidasService.registraComidaHecha(nombre).subscribe({
            next: () => this.cargarSugerencias(),
            error: (e) => console.error('No se pudo registrar la comida hecha:', e)
          });
        }
        // Note: original logic updated subject with response. 
        // If response is correct (Comidas[]), setting it.
        if (Array.isArray(response)) {
          this.data.set(response);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Error al agregar comidas.');
        this.loading.set(false);
      }
    });
  }

  borraComidas(id: number): void {
    this.data.update(items => items ? items.filter(c => c.producto.id !== id) : []);
  }

  modiCantidad(id: number, cantidad: string): void {
    this.data.update(items => {
      if (!items) return [];
      return items.map(item =>
        item.producto.id === id ? { ...item, cantidad: Number(cantidad) } : item
      );
    });
  }

  modiUnidad(id: number, unidad: string): void {
    this.data.update(items => {
      if (!items) return [];
      return items.map(item =>
        item.producto.id === id ? { ...item, unidades: unidad } : item
      );
    });
  }

  eliminarComida(comida: string, id: number): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: "Esta acción eliminará el producto de la comida permanentemente",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--primary)',
      cancelButtonColor: 'var(--secondary)',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: 'var(--surface-color)',
      color: 'var(--text-primary)'
    }).then((result) => {
      if (result.isConfirmed) {
        // Immediate UI update
        this.data.update(items => items ? items.filter(item => item.producto.id !== id) : []);

        this.comidasService.borraComidas(comida, id).subscribe({
          next: () => {
            Swal.fire({
              title: 'Eliminado',
              text: 'El producto ha sido eliminado.',
              icon: 'success',
              timer: 500,
              showConfirmButton: false
            });
          },
          error: () => {
            Swal.fire('Error', 'No se pudo completar la acción.', 'error');
            // Option: rollback if server fails?
          }
        });
      }
    });
  }

  // Elimina la comida seleccionada completa, con todos sus productos
  eliminarComidaCompleta(): void {
    const comida = this.currentMeal();
    if (!comida) return;
    const productos = this.data()?.length ?? 0;

    Swal.fire({
      title: `¿Eliminar la comida "${comida}"?`,
      text: productos > 0
        ? `Se borrarán la comida y sus ${productos} productos. Esta acción no se puede deshacer.`
        : 'Se borrará la comida y todos sus productos. Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--primary)',
      cancelButtonColor: 'var(--secondary)',
      confirmButtonText: 'Sí, eliminar comida',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.comidasService.borraComidaCompleta(comida).subscribe({
        next: () => {
          this.data.set([]);
          this.currentMeal.set('');
          this.cargarComidasUnicas();
          Swal.fire({
            title: 'Eliminada',
            text: `La comida "${comida}" ha sido eliminada.`,
            icon: 'success',
            timer: 800,
            showConfirmButton: false
          });
        },
        error: () => Swal.fire('Error', 'No se pudo eliminar la comida.', 'error')
      });
    });
  }

  editarComida(id: number, comida: string, cantidad: number, unidades: string): void {
    const item = this.data()?.find(c => c.producto.id === id);
    if (item) {
      this.mealModal()?.open(id, item.producto.nombre, { comida, cantidad, unidades });
    }
  }
}
