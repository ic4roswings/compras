import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { ListaI } from '../interface/lista.interface';

@Injectable({
  providedIn: 'root'
})
export class EncargoService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.appUrl;

  borraEncargo(id: number): Observable<ListaI> {
    return this.http.delete<ListaI>(`${this.apiUrl}borraEncargado/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  modificaEncargo(id: number, payload: any): Observable<ListaI> {
    return this.http.post<ListaI>(`${this.apiUrl}modificaEncargado/${id}`, payload)
      .pipe(
        catchError(this.handleError)
      );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => new Error(`Error: ${error.status}`));
  }
}
