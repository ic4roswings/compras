import { Component, ChangeDetectionStrategy, inject, input } from '@angular/core';

import { RouterModule, Router } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faStoreAlt, faSignOutAlt, faBars } from '@fortawesome/free-solid-svg-icons';
import { GlobalService } from '../service/global.service';

@Component({
  selector: 'app-cabecera',
  templateUrl: './cabecera.component.html',
  styleUrls: ['./cabecera.component.css'],
  standalone: true,
  imports: [RouterModule, FontAwesomeModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CabeceraComponent {
  private router = inject(Router);
  private global = inject(GlobalService);

  titulo = input<string>('');

  faStoreAlt = faStoreAlt;
  faSignOutAlt = faSignOutAlt;
  faBars = faBars;

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

  salir() {
    this.global.salir();
  }
}
