import { Component, OnInit, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';

import { RouterModule } from '@angular/router';
import { DataState } from '../enum/data-state.enum';
import { GlobalService } from '../service/global.service';
import { ListaService } from '../service/lista.service';
import { Donde } from '../enum/donde.enum';
import { SemanalService } from '../service/semanal.service';
import { CabeceraComponent } from '../cabecera/cabecera.component';
import Swal from 'sweetalert2';
import { ProductoI } from '../interface/producto.interface';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus, faFilter, faTrashAlt, faList, faCartPlus, faTimes, faClipboardList, faChevronDown, faBars, faBolt, faUndo, faSync } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-semanal',
  templateUrl: './semanal.component.html',
  styleUrls: ['./semanal.component.css'],
  standalone: true,
  imports: [RouterModule, CabeceraComponent, FontAwesomeModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SemanalComponent implements OnInit {
  private listaService = inject(ListaService);
  private global = inject(GlobalService);
  private semanalService = inject(SemanalService);

  // Icons
  faPlus = faPlus;
  faFilter = faFilter;
  faTrashAlt = faTrashAlt;
  faChevronDown = faChevronDown;
  faBars = faBars;
  faList = faList;
  faCartPlus = faCartPlus;
  faTimes = faTimes;
  faClipboardList = faClipboardList;
  faBolt = faBolt;
  faUndo = faUndo;
  faSync = faSync;

  readonly DataState = DataState;

  // Signals State
  data = signal<ProductoI[] | null>(null);
  removedItems = signal<ProductoI[]>([]); // Stack for Undo
  filtro = signal<Donde>(Donde.ALL);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  currentListId = signal<number>(1);

  // Computed state for the UI
  appState = computed(() => {
    if (this.loading()) return { dataState: DataState.LOADING_STATE };
    if (this.error()) return { dataState: DataState.ERROR_STATE, error: this.error() };

    // Apply filter locally if needed, although service filter$ is also used.
    // Ideally we filter the signal data.
    const rawData = this.data() || [];
    const filter = this.filtro();
    const filteredData = filter === Donde.ALL ? rawData : rawData.filter(p => p.donde === filter);

    return { dataState: DataState.LOADED_STATE, appData: filteredData };
  });

  // Constants
  todos = Donde.ALL;
  carnes = Donde.CARNES;
  walmart = Donde.WALMART;
  costco = Donde.COSTCO;
  mandado = Donde.MANDADO;

  constructor() {
    // Effect removed to prevent auto-save on load
  }

  async ngOnInit(): Promise<void> {
    await this.global.checkTokens('semanal');

    // Priority Load Logic
    const priorityIds = [1, 2, 3, 4]; // Semanal, Verificar, Mensual, Costco
    let foundSavedState = false;
    let bestCandidateId = 1;
    let highestScore = -1;

    // We must temporarily set the ID to check the storage, but if found, we keep it.
    // If not found, we revert or continue.
    // Actually, loadState() uses currentListId(), so we need to set it before calling loadState()

    // Scan phase
    for (const id of priorityIds) {
      const key = `semanal_state_${id}`;
      const saved = localStorage.getItem(key);

      if (saved) {
        foundSavedState = true; // Mark that we found at least one save
        let score = 0;
        try {
          const state = JSON.parse(saved);

          score += 1;
          if (state.removed && state.removed.length > 0) {
            score += 10;
          }

          if (score > highestScore) {
            highestScore = score;
            bestCandidateId = id;
          }
        } catch (e) {
          console.error(`Error parsing state for ${id}`, e);
        }
      }
    }

    // Set the best candidate found (or default 1 if none, handled below)
    if (foundSavedState) {
      this.currentListId.set(bestCandidateId);
      // We know it exists, so load it
      this.loadState();
    }

    // Default to ID 1 if no saved state found
    if (!foundSavedState) {
      this.listado(1);
    }
  }

  private getStorageKey(): string {
    return `semanal_state_${this.currentListId()}`;
  }

  private saveState() {
    const state = {
      data: this.data(),
      removed: this.removedItems(),
      filter: this.filtro()
    };
    // Only save if we actually have data loaded (don't overwrite with null on init)
    if (this.data() !== null) {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(state));
    }
  }

  private loadState(): boolean {
    const saved = localStorage.getItem(this.getStorageKey());
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.data) {
          this.data.set(state.data);
          this.removedItems.set(state.removed || []);
          this.filtro.set(state.filter || Donde.ALL);
          return true;
        }
      } catch (e) {
        console.error('Error parsing saved state', e);
        localStorage.removeItem(this.getStorageKey());
      }
    }
    return false;
  }

  listado(id: number) {
    this.currentListId.set(id);
    // Before loading new list, check if we have saved state for IT
    if (!this.loadState()) {
      this.fetchListado(id);
    }
  }

  private fetchListado(id: number) {
    this.loading.set(true);
    this.semanalService.listado(id).subscribe({
      next: (response) => {
        this.data.set(response);
        this.removedItems.set([]); // Reset removed stack on fresh load
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Error cargando el listado.');
        this.loading.set(false);
      }
    });
  }

  borraSemanal(id: number) {
    // 1. Find the item
    const currentData = this.data();
    if (!currentData) return;

    const itemToRemove = currentData.find(p => p.id === id);
    if (itemToRemove) {
      // 2. Add to removed stack
      this.removedItems.update(stack => [...stack, itemToRemove]);

      // 3. Update data signal
      this.data.update(items => items ? items.filter(p => p.id !== id) : []);
      this.saveState();
    }
  }

  undoDelete() {
    const stack = this.removedItems();
    if (stack.length === 0) return;

    const itemRestored = stack[stack.length - 1]; // Last item

    // 1. Remove from stack
    this.removedItems.update(s => s.slice(0, -1));

    // 2. Add back to data
    this.data.update(items => {
      if (!items) return [itemRestored];
      // Ideally we might want to preserve order, but appending is safest for now 
      // or we could sort if we had an index.
      return [...items, itemRestored];
    });
    this.saveState();
  }

  resetList() {
    Swal.fire({
      title: '¿Reiniciar Lista?',
      text: 'Se perderán los cambios locales y se cargará la lista original.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, reiniciar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem(this.getStorageKey());
        this.fetchListado(this.currentListId());
      }
    });
  }

  modiCantidad(id: number, cantidad: string) {
    this.data.update(items => {
      if (!items) return [];
      return items.map(item =>
        item.id === id ? { ...item, cantidad: Number(cantidad) } : item
      );
    });
    this.saveState();
  }

  modiUnidad(id: number, unidad: string) {
    this.data.update(items => {
      if (!items) return [];
      return items.map(item =>
        item.id === id ? { ...item, unidades: unidad } : item
      );
    });
    this.saveState();
  }

  agregaSemanal() {
    const currentData = this.data();
    if (!currentData || currentData.length === 0) {
      Swal.fire('Atención', 'No hay productos para agregar', 'info');
      return;
    }

    const pSemanal = currentData.map(element => ({
      producto: element.id,
      cantidad: element.cantidad,
      unidades: element.unidades
    }));

    this.listaService.agregaSemanal(pSemanal).subscribe(() => {
      // Clear memory for the current list after successful add
      localStorage.removeItem(this.getStorageKey());

      Swal.fire({
        title: 'Éxito',
        text: 'Agregado a la lista principal',
        icon: 'success',
        timer: 500,
        showConfirmButton: false
      }).then(() => {
        // Reload fresh list from server (clearing UI state effectively)
        this.fetchListado(this.currentListId());
      });
    });
  }

  filterSemanal(donde: Donde): void {
    this.filtro.set(donde);
    // We don't fetch from server anymore for local filtering to preserve local edits!
    // The computed appState handles the view filtering.
  }
}
