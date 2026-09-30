import { Injectable, inject } from '@angular/core';
import { tokenRefreshI } from '../interface/tokenRefresh.interface';
import { LoginService } from './login.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class GlobalService {
  private login = inject(LoginService);
  private router = inject(Router);

  public async checkTokens(navigate: string) {
    const token = localStorage.getItem('token');

    if (!token && !localStorage.getItem('refresh')) {
      this.handleAuthError();
      return;
    }

    this.login.verifyToken({ token } as tokenRefreshI).subscribe({
      next: () => this.router.navigate([navigate]),
      error: (err) => {
        // Sin conexión o error del servidor: no es una sesión vencida, no cierres sesión
        if (this.esFalloDeRed(err)) {
          return;
        }
        this.login.renovar().subscribe({
          next: () => this.router.navigate([navigate]),
          error: (e) => {
            if (!this.esFalloDeRed(e)) {
              this.handleAuthError();
            }
          }
        });
      }
    });
  }

  private esFalloDeRed(err: { status?: number }): boolean {
    return err.status === 0 || (err.status ?? 0) >= 500;
  }

  private handleAuthError() {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh');
    this.router.navigate(['login']);
  }

  public salir() {
    this.handleAuthError();
  }
}
