import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Donde } from '../enum/donde.enum';
import { ProductoI } from '../interface/producto.interface';
import { environment } from '../../environments/environment';
import { ListaI } from '../interface/lista.interface';
import { AgregaListaI } from '../interface/agregalista.interface';

@Injectable({
  providedIn: 'root'
})
export class SemanalService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.appUrl;

  semanal$ = this.http.get<ProductoI[]>(`${this.apiUrl}filtrado/1`)
    .pipe(
      catchError(this.handleError)
    );

  listado = (id: number) =>
    this.http.get<ProductoI[]>(`${this.apiUrl}filtrado/${id}`)
      .pipe(
        catchError(this.handleError)
      );

  agregaSemanal(semanal: ProductoI[]): Observable<ListaI> {
    let agregaSem: AgregaListaI[] = [];
    for (let producto of semanal) {
      agregaSem.push({
        producto: producto.id,
        cantidad: producto.cantidad,
        unidades: producto.unidades,
      });
    }
    return this.http.post<ListaI>(`${this.apiUrl}lista/`, agregaSem)
      .pipe(
        catchError(this.handleError)
      );
  }

  filter$ = (donde: Donde, response: ProductoI[]) =>
    new Observable<ProductoI[]>(
      suscriber => {
        suscriber.next(
          donde === Donde.ALL ? response :
            response.filter(item => item.donde === donde)
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
