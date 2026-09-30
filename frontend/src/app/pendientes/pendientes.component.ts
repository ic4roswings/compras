import { Component, OnInit, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';

import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { catchError, map, of } from 'rxjs';
import { DataState } from '../enum/data-state.enum';
import { GlobalService } from '../service/global.service';
import { PendientesService } from '../service/pendientes.service';
import { Pendientes } from '../interface/pendientes';
import { CabeceraComponent } from '../cabecera/cabecera.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus, faCheck, faTasks, faTimes } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-pendientes',
  templateUrl: './pendientes.component.html',
  styleUrls: ['./pendientes.component.css'],
  standalone: true,
  imports: [FormsModule, RouterModule, CabeceraComponent, FontAwesomeModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PendientesComponent implements OnInit {
  private pendienteService = inject(PendientesService);
  private global = inject(GlobalService);
  private router = inject(Router);

  // Icons
  faPlus = faPlus;
  faCheck = faCheck;
  faTasks = faTasks;
  faTimes = faTimes;

  readonly DataState = DataState;

  // State Signals
  data = signal<Pendientes[] | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  // Computed state for the UI
  appState = computed(() => {
    if (this.loading()) return { dataState: DataState.LOADING_STATE };
    if (this.error()) return { dataState: DataState.ERROR_STATE, error: this.error() };
    return { dataState: DataState.LOADED_STATE, appData: this.data() || [] };
  });

  async ngOnInit(): Promise<void> {
    await this.global.checkTokens('pendientes');
    this.loadData();
  }

  private loadData() {
    this.loading.set(true);
    this.pendienteService.pendientes$.subscribe({
      next: (response) => {
        this.data.set(response);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading pendientes:', err);
        this.error.set('No se pudo cargar la lista de pendientes.');
        this.loading.set(false);
      }
    });
  }

  agregaPendiente(pendiente: string) {
    if (!pendiente.trim()) return;

    const nuevo: Pendientes = { pendiente: pendiente };
    this.loading.set(true);

    this.pendienteService.agregaPendiente(nuevo).subscribe({
      next: (response) => {
        // Optimistic UI update or full refresh? Let's do a refresh to ensure consistency with backend IDs
        this.loadData();
      },
      error: (err) => {
        console.error('Error adding pendiente:', err);
        this.error.set('No se pudo agregar el pendiente.');
        this.loading.set(false);
      }
    });
  }

  completaPendiente(id: number) {
    // Optimistic update
    const previousData = this.data();
    this.data.update(items => items ? items.filter(p => p.id !== id) : []);

    this.pendienteService.borraPendiente(id).subscribe({
      error: (err) => {
        console.error('Error completing pendiente:', err);
        // Rollback on error
        this.data.set(previousData);
        this.error.set('No se pudo completar el pendiente.');
      }
    });
  }
}
