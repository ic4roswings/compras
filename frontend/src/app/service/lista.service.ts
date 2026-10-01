import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Donde } from '../enum/donde.enum';
import { ProductoI } from '../interface/producto.interface';
import { environment } from '../../environments/environment';
import { ListaI } from '../interface/lista.interface';

@Injectable({
  providedIn: 'root'
})
export class ListaService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.appUrl;

  lista$ = this.http.get<ListaI[]>(`${this.apiUrl}damelista/`)
    .pipe(
      catchError(this.handleError)
    );

  encargado$ = this.http.get<ListaI[]>(`${this.apiUrl}dameEncargado/`)
    .pipe(
      catchError(this.handleError)
    );

  producto_filtrado = (busqueda: string) =>
    this.http.get<ProductoI[]>(`${this.apiUrl}productos/${busqueda}`)
      .pipe(
        catchError(this.handleError)
      );

  borraLista(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}lista/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  // Cambia cantidad y unidad de un elemento de la lista (el backend exige también el id del producto)
  modificaLista(id: number, payload: { producto: number; cantidad: number; unidades: string }): Observable<any> {
    return this.http.put(`${this.apiUrl}lista/${id}`, payload)
      .pipe(
        catchError(this.handleError)
      );
  }

  borraTodaLista(): Observable<any> {
    return this.http.delete(`${this.apiUrl}lista/delete`)
      .pipe(
        catchError(this.handleError)
      );
  }

  borraListaSinCostco(): Observable<any> {
    return this.http.delete(`${this.apiUrl}lista/deletenc`)
      .pipe(
        catchError(this.handleError)
      );
  }

  agregaEncargo(lista: ListaI[]): Observable<any> {
    return this.http.delete(`${this.apiUrl}lista/addenc`, {
      body: lista
    })
      .pipe(
        catchError(this.handleError)
      );
  }

  agregaSemanal(pSemanal: any): Observable<any> {
    return this.http.post(`${this.apiUrl}lista/`, pSemanal)
      .pipe(
        catchError(this.handleError)
      );
  }

  filter$ = (donde: Donde, response: ListaI[]) =>
    new Observable<ListaI[]>(
      suscriber => {
        suscriber.next(
          donde === Donde.ALL ? response :
            response.filter(lista => lista.producto.donde === donde)
        );
        suscriber.complete();
      }
    ).pipe(
      catchError(this.handleError)
    );

  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => new Error(`Error: ${error.status}`));
  }
}
