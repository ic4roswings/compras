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
import { BaseComida } from '../interface/base-comida.interface';
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
  agregaProductosAComida = (comida: string, items: { producto: number; cantidad: number; unidades: string }[], tipo?: number | null, base?: string | null): Observable<AgregaComida[]> => {
    const payload: AgregaComida[] = items.map(i => ({
      comida,
      ...(tipo ? { tipo } : {}),
      ...(base ? { base } : {}),
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

  // Catálogo de bases (pollo, res, pavo...)
  bases$ = (): Observable<BaseComida[]> => this.http.get<BaseComida[]>(`${this.apiUrl}bases/`);

  // Asigna la base a la comida (texto; si no existe en el catálogo se crea; vacío la quita)
  cambiaBaseComida(comida: string, base: string): Observable<any> {
    return this.http.post(`${this.apiUrl}comidas/${encodeURIComponent(comida)}/base/`, { base });
  }

  // Cambia el tipo de la comida (1 entre semana, 2 fin de semana)
  cambiaTipoComida(comida: string, tipo: number): Observable<any> {
    return this.http.post(`${this.apiUrl}comidas/${encodeURIComponent(comida)}/tipo/`, { tipo });
  }

  // Registra que se hizo la comida (alimenta las métricas)
  registraComidaHecha(comida: string): Observable<any> {
    return this.http.post(`${this.apiUrl}comidas/${encodeURIComponent(comida)}/hecha/`, {});
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
