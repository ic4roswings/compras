import { Component, OnInit, ViewChild, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';

import { RouterModule } from '@angular/router';
import { DataState } from '../enum/data-state.enum';
import { GlobalService } from '../service/global.service';
import { ListaService } from '../service/lista.service';
import { ListaI } from '../interface/lista.interface';
import { Donde } from '../enum/donde.enum';
import { EncargoService } from '../service/encargo.service';
import { CabeceraComponent } from '../cabecera/cabecera.component';
import Swal from 'sweetalert2';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus, faExternalLinkAlt, faTrashAlt, faFilter, faSearch, faArrowLeft, faShoppingCart, faEdit, faTimes, faChevronDown, faBolt } from '@fortawesome/free-solid-svg-icons';
import { AgregarProductosComponent } from '../agregar-productos/agregar-productos.component';

@Component({
  selector: 'app-encargado',
  templateUrl: './encargado.component.html',
  styleUrls: ['./encargado.component.css'],
  standalone: true,
  imports: [RouterModule, CabeceraComponent, FontAwesomeModule, AgregarProductosComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EncargadoComponent implements OnInit {
  private listaService = inject(ListaService);
  private global = inject(GlobalService);
  private encargoService = inject(EncargoService);

  // Icons
  faSearch = faSearch;
  faArrowLeft = faArrowLeft;
  faShoppingCart = faShoppingCart;
  faExternalLinkAlt = faExternalLinkAlt;
  faFilter = faFilter;
  faTimes = faTimes;
  faChevronDown = faChevronDown;
  faPlus = faPlus;
  faTrashAlt = faTrashAlt;
  faEdit = faEdit;
  faBolt = faBolt;

  @ViewChild('productModal') productModal!: AgregarProductosComponent;

  readonly DataState = DataState;

  // Signals State
  private data = signal<ListaI[] | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  filtro = signal<Donde>(Donde.ALL);

  // Computed state for UI
  appState = computed(() => {
    if (this.loading()) return { dataState: DataState.LOADING_STATE };
    if (this.error()) return { dataState: DataState.ERROR_STATE, error: this.error() };

    const rawData = this.data() || [];
    const filterValue = this.filtro();
    const filteredContent = filterValue === Donde.ALL
      ? rawData
      : rawData.filter(item => item.producto.donde === filterValue);

    return {
      dataState: DataState.LOADED_STATE,
      appData: filteredContent
    };
  });

  // Enums for Template
  todos = Donde.ALL;
  carnes = Donde.CARNES;
  walmartEnum = Donde.WALMART;
  costco = Donde.COSTCO;
  mandado = Donde.MANDADO;

  // Walmart Sequence State
  private completados = new Set<number>();
  private omitidosEnCorrida = new Set<number>();

  async ngOnInit(): Promise<void> {
    await this.global.checkTokens('encargado');
    this.fetchData();
  }

  fetchData() {
    this.loading.set(true);
    this.listaService.encargado$.subscribe({
      next: (response) => {
        this.data.set(response);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('No se pudieron cargar los encargos.');
        this.loading.set(false);
      }
    });
  }

  borraLista(id: number) {
    Swal.fire({
      title: '¿Estás seguro?',
      text: '¡Esto eliminará el producto de la lista!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: 'var(--primary)',
      cancelButtonColor: 'var(--secondary)',
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        // Local update for immediate feedback
        const previousData = this.data();
        this.data.update(items => items ? items.filter(p => p.id !== id) : []);

        this.encargoService.borraEncargo(id).subscribe({
          next: () => {
            Swal.fire({
              title: 'Borrado',
              text: 'El producto ha sido eliminado.',
              icon: 'success',
              timer: 500,
              showConfirmButton: false
            });
          },
          error: () => {
            // Revert on error
            this.data.set(previousData);
            Swal.fire('Error', 'No se pudo eliminar el producto.', 'error');
          }
        });
      }
    });
  }

  filterLista(donde: Donde): void {
    this.filtro.set(donde);
  }

  async walmart(manual: boolean = false): Promise<void> {
    if (manual) {
      this.omitidosEnCorrida.clear();
    }

    if (await this.abrirModalEdicion()) {
      return;
    }

    await this.abrirTiendaWalmart();
  }

  async abrirModalEdicion(): Promise<boolean> {
    const items = this.data() || [];
    const missingUrlItem = items.find(i =>
      i.producto.donde === 'Walmart' &&
      (!i.producto.URL || i.producto.URL === '-' || i.producto.URL.trim() === '') &&
      !this.completados.has(i.id) &&
      !this.omitidosEnCorrida.has(i.id)
    );

    if (missingUrlItem) {
      const result = await Swal.fire({
        title: 'Falta URL',
        text: `El producto "${missingUrlItem.producto.nombre}" no tiene URL de Walmart.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--primary)',
        cancelButtonColor: 'var(--secondary)',
        confirmButtonText: 'Agregar ahora',
        cancelButtonText: 'Saltar producto'
      });

      if (result.isConfirmed) {
        this.productModal.open(missingUrlItem.producto);
        return true;
      } else {
        this.omitidosEnCorrida.add(missingUrlItem.id);
        return await this.abrirModalEdicion();
      }
    }
    return false;
  }

  async abrirTiendaWalmart(): Promise<void> {
    const items = this.data() || [];
    const walmartItems = items.filter(i =>
      i.producto.donde === 'Walmart' &&
      !this.completados.has(i.id) &&
      !this.omitidosEnCorrida.has(i.id)
    );

    if (walmartItems.length === 0) {
      if (this.completados.size > 0 || this.omitidosEnCorrida.size > 0) {
        Swal.fire({
          title: 'Fin de secuencia',
          text: 'Se han procesado o saltado todos los productos de Walmart.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      }
      return;
    }

    for (const item of walmartItems) {
      const result = await Swal.fire({
        title: `¿Agregar ${item.cantidad} ${item.unidades} de ${item.producto.nombre}?`,
        text: "Se abrirá la página de Walmart Super",
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: 'var(--primary)',
        cancelButtonColor: 'var(--secondary)',
        confirmButtonText: 'Sí, abrir link',
        cancelButtonText: 'Saltar / Siguiente'
      });

      if (result.isConfirmed) {
        this.abrirWalmartDirecto(item);
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        this.omitidosEnCorrida.add(item.id);
        continue;
      } else {
        break;
      }
    }
  }

  abrirWalmartDirecto(item: ListaI) {
    if (item.producto.URL && item.producto.URL !== '-') {
      window.open('https://super.walmart.com.mx' + item.producto.URL, '_blank');
      this.completados.add(item.id);
    }
  }

  async onModalSave() {
    this.fetchData();
    this.omitidosEnCorrida.clear();
    // Re-check walmart after data is reloaded signal (using a timeout for simplicity as modal might take time)
    setTimeout(() => this.walmart(), 500);
  }

  abrirEditor(lista: ListaI) {
    Swal.fire({
      title: 'Modificar Encargo',
      html: `
      <input id="swal-cantidad" class="swal2-input" placeholder="Cantidad" type="number" value="${lista.cantidad}">
      <select id="swal-unidad" class="swal2-select">
        <option value="PZ" ${lista.unidades === 'PZ' ? 'selected' : ''}>PZ</option>
        <option value="G" ${lista.unidades === 'G' ? 'selected' : ''}>G</option>
        <option value="KG" ${lista.unidades === 'KG' ? 'selected' : ''}>KG</option>
        <option value="Paquete" ${lista.unidades === 'Paquete' ? 'selected' : ''}>Paquete</option>
      </select>
    `,
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const cantidad = (document.getElementById('swal-cantidad') as HTMLInputElement).value;
        const unidad = (document.getElementById('swal-unidad') as HTMLSelectElement).value;

        if (!cantidad || isNaN(Number(cantidad)) || Number(cantidad) <= 0) {
          Swal.showValidationMessage('La cantidad debe ser un número mayor que 0');
          return false;
        }
        return { cantidad: Number(cantidad), unidades: unidad };
      }
    }).then(result => {
      if (result.isConfirmed && result.value) {
        const payload = {
          cantidad: result.value.cantidad,
          unidades: result.value.unidades
        };

        this.encargoService.modificaEncargo(lista.id, payload).subscribe({
          next: () => {
            Swal.fire({
              title: 'Modificado',
              text: 'El producto ha sido actualizado.',
              icon: 'success',
              timer: 500,
              showConfirmButton: false
            });

            // Reactive update: change content in the signal
            this.data.update(items => {
              if (!items) return null;
              return items.map(item =>
                item.id === lista.id
                  ? { ...item, cantidad: payload.cantidad, unidades: payload.unidades }
                  : item
              );
            });
          },
          error: () => {
            Swal.fire('Error', 'No se pudo modificar el producto.', 'error');
          }
        });
      }
    });
  }
}
