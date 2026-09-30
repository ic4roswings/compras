import { Component, OnInit, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';

import { RouterModule, Router } from '@angular/router';
import { DataState } from '../enum/data-state.enum';
import { ListaI } from '../interface/lista.interface';
import { GlobalService } from '../service/global.service';
import { ListaService } from '../service/lista.service';
import { Donde } from '../enum/donde.enum';
import { CabeceraComponent } from '../cabecera/cabecera.component';
import Swal from 'sweetalert2';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faFilter, faPlus, faTrashAlt, faTimes, faBars, faCartArrowDown, faSearch, faChevronDown, faSyncAlt, faTrash, faCheckDouble, faCartPlus, faBolt } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-lista',
  templateUrl: './lista.component.html',
  styleUrls: ['./lista.component.css'],
  standalone: true,
  imports: [RouterModule, CabeceraComponent, FontAwesomeModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ListaComponent implements OnInit {
  private listaService = inject(ListaService);
  private global = inject(GlobalService);
  private router = inject(Router);

  // Icons
  faSearch = faSearch;
  faChevronDown = faChevronDown;
  faSyncAlt = faSyncAlt;
  faTrash = faTrash;
  faCheckDouble = faCheckDouble;
  faCartPlus = faCartPlus;
  faFilter = faFilter;
  faPlus = faPlus;
  faTrashAlt = faTrashAlt;
  faTimes = faTimes;
  faBars = faBars;
  faCartArrowDown = faCartArrowDown;
  faBolt = faBolt;

  readonly DataState = DataState;

  // Signals State
  data = signal<ListaI[] | null>(null);
  filtro = signal<Donde>(Donde.ALL);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  // Computed state for the UI
  appState = computed(() => {
    if (this.loading()) return { dataState: DataState.LOADING_STATE };
    if (this.error()) return { dataState: DataState.ERROR_STATE, error: this.error() };

    const rawData = this.data() || [];
    const filter = this.filtro();
    const filteredData = filter === Donde.ALL ? rawData : rawData.filter(p => p.producto.donde === filter);

    return { dataState: DataState.LOADED_STATE, appData: filteredData };
  });

  // Constants
  todos = Donde.ALL;
  carnes = Donde.CARNES;
  walmart = Donde.WALMART;
  costco = Donde.COSTCO;
  mandado = Donde.MANDADO;

  async ngOnInit(): Promise<void> {
    await this.global.checkTokens('lista');
    this.loadData();
  }

  private loadData() {
    this.loading.set(true);
    this.listaService.lista$.subscribe({
      next: (response) => {
        this.data.set(response);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading list data:', err);
        this.error.set('No se pudo cargar la lista.');
        this.loading.set(false);
      }
    });
  }

  filtraBusqueda(busqueda: string) {
    this.loading.set(true);
    this.listaService.producto_filtrado(busqueda).subscribe({
      next: (response) => {
        this.data.set(response);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  agregar() {
    const currentData = this.data();
    if (!currentData) return;

    this.listaService.agregaEncargo(currentData).subscribe(() => {
      this.data.set([]);
    });
  }

  sinCostco() {
    this.listaService.borraListaSinCostco().subscribe(() => {
      this.loadData();
    });
  }

  borraLista(id: number) {
    Swal.fire({
      title: '¿Estás seguro?',
      text: '¡Esto eliminará el producto de la lista!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.listaService.borraLista(id).subscribe(() => {
          this.data.update(items => items ? items.filter(p => p.id !== id) : []);
          Swal.fire({
            title: 'Borrado',
            text: 'El producto ha sido eliminado.',
            icon: 'success',
            timer: 500,
            showConfirmButton: false
          });
        });
      }
    });
  }

  completar() {
    this.listaService.borraTodaLista().subscribe(() => {
      this.data.set([]);
      Swal.fire('Éxito', 'Toda la lista ha sido completada.', 'success');
    });
  }

  filterLista(donde: Donde): void {
    this.filtro.set(donde);
  }
}
