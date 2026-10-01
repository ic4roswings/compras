import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { Donde } from '../enum/donde.enum';
import { ProductoI } from '../interface/producto.interface';
import { environment } from '../../environments/environment';
import { ListaI } from '../interface/lista.interface';
import { AgregaListaI } from '../interface/agregalista.interface';
import { ComidasUnicas } from '../interface/comidas-unicas.interface';
import { Comidas } from '../interface/comidas.interface';
import { AgregaComida } from '../interface/agrega-comida.interface';

@Injectable({
  providedIn: 'root'
})
export class ComidasService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.appUrl;

  obtenerComidasUnicas(): Observable<any> {
    return this.http.get<ComidasUnicas[]>(`${this.apiUrl}comidas/`);
  }

  producto = (id: Number): Observable<Comidas> =>
    this.http.get<ProductoI>(`${this.apiUrl}productos/${id}`)
      .pipe(map((producto: ProductoI) => {
        const comida: Comidas = {
          comida: '',
          producto: producto,
          cantidad: producto.cantidad,
          unidades: producto.unidades
        };
        return comida;
      }),
        catchError(this.handleError)
      );

  producto2 = (id: Number, laComida: string, cantidad: number, unidades: string): Observable<Comidas> =>
    this.http.get<ProductoI>(`${this.apiUrl}productos/${id}`)
      .pipe(map((producto: ProductoI) => {
        const comida: Comidas = {
          comida: laComida,
          producto: producto,
          cantidad: cantidad,
          unidades: unidades
        };
        return comida;
      }),
        catchError(this.handleError)
      );

  agregaAComida = (producto: AgregaComida): Observable<AgregaComida> =>
    this.http.post<AgregaComida>(`${this.apiUrl}agregaComidas/`, [producto])
      .pipe(
        catchError(this.handleError)
      );

  // Varios productos a una misma comida en una sola petición (el backend la procesa en una transacción)
  agregaProductosAComida = (comida: string, items: { producto: number; cantidad: number; unidades: string }[]): Observable<AgregaComida[]> => {
    const payload: AgregaComida[] = items.map(i => ({
      comida,
      producto: i.producto,
      cantidad: i.cantidad,
      unidades: i.unidades
    }));
    return this.http.post<AgregaComida[]>(`${this.apiUrl}agregaComidas/`, payload)
      .pipe(
        catchError(this.handleError)
      );
  };

  actualizaProducto = (producto: ProductoI, id: Number): Observable<ProductoI> =>
    this.http.put<ProductoI>(`${this.apiUrl}productos/${id}`, producto)
      .pipe(
        catchError(this.handleError)
      );

  comidas$ = (filtro: string): Observable<Comidas[]> =>
    this.http.get<Comidas[]>(`${this.apiUrl}dameComidas/${filtro}/`)
      .pipe(
        catchError(this.handleError)
      );

  verifica$: Observable<ProductoI[]> =
    this.http.get<ProductoI[]>(`${this.apiUrl}filtrado/2`)
      .pipe(
        catchError(this.handleError)
      );

  mensual$: Observable<ProductoI[]> =
    this.http.get<ProductoI[]>(`${this.apiUrl}filtrado/3`)
      .pipe(
        catchError(this.handleError)
      );

  costco$: Observable<ProductoI[]> =
    this.http.get<ProductoI[]>(`${this.apiUrl}filtrado/4`)
      .pipe(
        catchError(this.handleError)
      );

  producto_filtrado = (busqueda: string): Observable<ProductoI[]> =>
    this.http.get<ProductoI[]>(`${this.apiUrl}productos/${busqueda}`)
      .pipe(
        catchError(this.handleError)
      );

  guarda_producto$ = (producto: ProductoI): Observable<ProductoI> =>
    this.http.post<ProductoI>(`${this.apiUrl}productos/`, producto)
      .pipe(
        catchError(this.handleError)
      );

  borraComidas(comida: string, id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}borraComidas/${comida}/${id}`)
      .pipe(
        catchError(this.handleError)
      );
  }

  // Elimina la comida completa (todos sus productos)
  borraComidaCompleta(comida: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}comidas/${encodeURIComponent(comida)}/`)
      .pipe(
        catchError(this.handleError)
      );
  }

  agregaComidas(comidas: Comidas[]): Observable<ListaI> {
    let agregaSem: AgregaListaI[] = [];
    for (let comida of comidas) {
      agregaSem.push({
        producto: comida.producto.id,
        cantidad: comida.cantidad,
        unidades: comida.unidades,
      });
    }
    return this.http.post<ListaI>(`${this.apiUrl}lista/`, agregaSem)
      .pipe(
        catchError(this.handleError)
      );
  }

  filter$ = (donde: Donde, response: Comidas[]): Observable<Comidas[]> =>
    new Observable<Comidas[]>(
      suscriber => {
        suscriber.next(
          donde === Donde.ALL ? response :
            response.filter(comida => comida.producto.donde === donde)
        );
        suscriber.complete();
      }
    ).pipe(
      catchError(this.handleError)
    );

  private handleError(error: HttpErrorResponse): Observable<never> {
    return throwError(() => `Error: ${error.status}`);
  }
}
