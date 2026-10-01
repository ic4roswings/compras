import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';

export interface EstadoVectores {
  total: number;
  al_dia: number;
  desfasados: number;
}

export interface ResultadoSincronizacion {
  sincronizados: number;
  total: number;
}

// Tras una edición el vector se actualiza en segundo plano (hasta ~10 s con reintentos): si al revisar
// aparece algún desfase, se espera y se vuelve a revisar antes de avisar, para no dar falsas alarmas.
const ESPERA_CONFIRMACION_MS = 12_000;
const INTERVALO_MINIMO_MS = 60_000;
const REVISION_PERIODICA_MS = 120_000;

@Injectable({
  providedIn: 'root'
})
export class VectoresService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.appUrl;

  // Productos cuyo vector falló y sigue desfasado: el navbar muestra RESYNC cuando es > 0
  readonly desfasados = signal(0);
  readonly sincronizando = signal(false);

  private ultimaRevision = 0;
  private revisando = false;

  constructor() {
    setInterval(() => {
      if (!document.hidden && localStorage.getItem('token')) {
        this.revisar();
      }
    }, REVISION_PERIODICA_MS);
  }

  estado() {
    return this.http.get<EstadoVectores>(`${this.apiUrl}vectores/estado/`);
  }

  sincronizar() {
    return this.http.post<ResultadoSincronizacion>(`${this.apiUrl}vectores/sync/`, {});
  }

  // forzar = revisar ya y sin espera de confirmación (p. ej. justo después de sincronizar)
  revisar(forzar = false) {
    const ahora = Date.now();
    if (this.revisando || (!forzar && ahora - this.ultimaRevision < INTERVALO_MINIMO_MS)) {
      return;
    }
    this.revisando = true;
    this.ultimaRevision = ahora;
    const terminar = () => { this.revisando = false; };

    this.estado().subscribe({
      next: (primera) => {
        if (forzar || primera.desfasados === 0) {
          this.desfasados.set(primera.desfasados);
          terminar();
          return;
        }
        setTimeout(() => {
          this.estado().subscribe({
            next: (segunda) => { this.desfasados.set(segunda.desfasados); terminar(); },
            error: terminar
          });
        }, ESPERA_CONFIRMACION_MS);
      },
      error: terminar
    });
  }
}
