import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { loginI } from '../interface/login.interface';
import { loginRI } from '../interface/loginResponse.interface';
import { tokenRefreshI } from '../interface/tokenRefresh.interface';

export class HttpStatusError extends Error {
  constructor(public status: number) {
    super(`Error: ${status}`);
  }
}

@Injectable({
  providedIn: 'root'
})
export class LoginService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.appUrl;
  private renovando$?: Observable<string>;

  onLogin(form: loginI): Observable<loginRI> {
    return this.http.post<loginRI>(`${this.apiUrl}login/`, form)
      .pipe(catchError(this.handleError));
  }

  verifyToken(token: tokenRefreshI): Observable<tokenRefreshI> {
    return this.http.post<tokenRefreshI>(`${this.apiUrl}token/verify/`, token)
      .pipe(catchError(this.handleError));
  }

  refreshToken(token: tokenRefreshI): Observable<tokenRefreshI> {
    return this.http.post<tokenRefreshI>(`${this.apiUrl}token/refresh/`, token)
      .pipe(catchError(this.handleError));
  }

  // Renueva el access token con el refresh guardado. Si varias peticiones fallan a la vez
  // comparten una sola renovación. Guarda el refresh nuevo cuando el backend lo rota.
  renovar(): Observable<string> {
    const refresh = localStorage.getItem('refresh');
    if (!refresh) {
      return throwError(() => new HttpStatusError(401));
    }
    if (!this.renovando$) {
      this.renovando$ = this.refreshToken({ refresh } as tokenRefreshI).pipe(
        map(data => {
          localStorage.setItem('token', data.access!);
          if (data.refresh) {
            localStorage.setItem('refresh', data.refresh);
          }
          return data.access!;
        }),
        finalize(() => this.renovando$ = undefined),
        shareReplay(1)
      );
    }
    return this.renovando$;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => new HttpStatusError(error.status));
  }
}
