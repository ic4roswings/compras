import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { Pendientes } from '../interface/pendientes';

@Injectable({
  providedIn: 'root'
})
export class PendientesService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.appUrl;

  pendientes$ = this.http.get<Pendientes[]>(`${this.apiUrl}pendientes/`)
    .pipe(
      catchError(this.handleError)
    );

  borraPendiente(id: number): Observable<Pendientes> {
    return this.http.delete<Pendientes>(`${this.apiUrl}pendientes/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  agregaPendiente = (pendientes: Pendientes) =>
    this.http.post<Pendientes>(`${this.apiUrl}pendientes/`, pendientes)
      .pipe(
        catchError(this.handleError)
      );

  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => new Error(`Error: ${error.status}`));
  }
}
