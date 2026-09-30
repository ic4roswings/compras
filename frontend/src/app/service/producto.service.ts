import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Donde } from '../enum/donde.enum';
import { ProductoI } from '../interface/producto.interface';
import { environment } from '../../environments/environment';
import { AgregaListaI } from '../interface/agregalista.interface';

@Injectable({
  providedIn: 'root'
})
export class ProductoService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.appUrl;

  productos$ = this.http.get<ProductoI[]>(`${this.apiUrl}productos/`)
    .pipe(
      catchError(this.handleError)
    );

  producto = (id: number) => this.http.get<ProductoI>(`${this.apiUrl}productos/${id}`)
    .pipe(
      catchError(this.handleError)
    );

  producto_filtrado = (busqueda: string) => this.http.get<ProductoI[]>(`${this.apiUrl}productos/${busqueda}`)
    .pipe(
      catchError(this.handleError)
    );

  guardaProducto = (producto: ProductoI[]) => this.http.post<ProductoI>(`${this.apiUrl}productos/`, producto)
    .pipe(
      catchError(this.handleError)
    );

  actualizaProducto = (producto: ProductoI, id: number) => this.http.put<ProductoI>(`${this.apiUrl}productos/${id}`, producto)
    .pipe(
      catchError(this.handleError)
    );

  borraProducto = (id: number): Observable<any> =>
    this.http.delete(`${this.apiUrl}productos/${id}`)
      .pipe(
        catchError(this.handleError)
      );

  agregaLista = (producto: AgregaListaI) => this.http.post<any>(`${this.apiUrl}lista/`, [producto])
    .pipe(
      catchError(this.handleError)
    );

  generaLista = (): Observable<any> =>
    this.http.get(`${this.apiUrl}generaLista/`)
      .pipe(
        catchError(this.handleError)
      );

  filter$ = (donde: Donde, response: ProductoI[]) =>
    new Observable<ProductoI[]>(
      suscriber => {
        suscriber.next(
          donde === Donde.ALL ? response :
            response.filter(producto => producto.donde === donde)
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
