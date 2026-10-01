import { Component, ChangeDetectionStrategy, OnInit, inject, input } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { RouterModule, Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faStoreAlt, faSignOutAlt, faBars } from '@fortawesome/free-solid-svg-icons';
import { GlobalService } from '../service/global.service';
import { VectoresService } from '../service/vectores.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-cabecera',
  templateUrl: './cabecera.component.html',
  styleUrls: ['./cabecera.component.css'],
  standalone: true,
  imports: [RouterModule, FontAwesomeModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CabeceraComponent implements OnInit {
  private router = inject(Router);
  private global = inject(GlobalService);
  vectores = inject(VectoresService);

  titulo = input<string>('');

  faStoreAlt = faStoreAlt;
  faSignOutAlt = faSignOutAlt;
  faBars = faBars;

  ngOnInit(): void {
    this.vectores.revisar();
  }

  // Sincroniza solo los productos cuyo vector falló (cálculo incremental)
  resync() {
    if (this.vectores.sincronizando()) {
      return;
    }
    this.vectores.sincronizando.set(true);
    this.vectores.sincronizar().subscribe({
      next: (r) => {
        this.vectores.sincronizando.set(false);
        Swal.fire({
          title: 'Sincronizado',
          text: r.sincronizados === 1 ? 'Se sincronizó 1 producto.' : `Se sincronizaron ${r.sincronizados} productos.`,
          icon: 'success',
          timer: 1200,
          showConfirmButton: false
        });
        this.vectores.revisar(true);
      },
      error: (e: HttpErrorResponse) => {
        this.vectores.sincronizando.set(false);
        this.muestraErrorResync(e);
        this.vectores.revisar(true);
      }
    });
  }

  private muestraErrorResync(e: HttpErrorResponse) {
    const detalle: string | undefined = e.error?.detalle;
    if (e.status === 402 && e.error?.error === 'cuota_openai') {
      Swal.fire({
        title: 'OpenAI: exceso de pago',
        text: detalle ?? 'OpenAI rechazó la petición por falta de saldo o cuota agotada.',
        icon: 'error',
        confirmButtonText: 'Entendido'
      });
    } else if (e.status === 409) {
      Swal.fire('En curso', detalle ?? 'Ya hay una sincronización en curso.', 'info');
    } else {
      Swal.fire('Error', detalle ?? 'No se pudo completar la sincronización.', 'error');
    }
  }

  navigateProductos() {
    this.router.navigate(['productos']);
  }

  navigateLista() {
    this.router.navigate(['lista']);
  }

  navigateSemanal() {
    this.router.navigate(['semanal']);
  }

  navigateEncargado() {
    this.router.navigate(['encargado']);
  }

  navigateChecklist() {
    this.router.navigate(['checklist']);
  }

  navigateComidas() {
    this.router.navigate(['comidas']);
  }

  navigateAgregarComidas() {
    this.router.navigate(['agregarComidas']);
  }

  navigatePendientes() {
    this.router.navigate(['pendientes']);
  }

  navigateMetricas() {
    this.router.navigate(['metricas']);
  }

  salir() {
    this.global.salir();
  }
}
