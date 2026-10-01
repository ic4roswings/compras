import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from 'src/environments/environment';
import { MetricaComida, MetricaProducto, SugerenciaComida } from '../interface/metricas.interface';

@Injectable({
  providedIn: 'root'
})
export class MetricasService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.appUrl;

  productos$ = () => this.http.get<MetricaProducto[]>(`${this.apiUrl}metricas/productos/`);
  // `excluir`: comidas ya sugeridas, para pedir otras distintas
  sugerencias$ = (excluir: string[] = []) =>
    this.http.get<SugerenciaComida[]>(`${this.apiUrl}sugerencias/comidas/`, { params: { excluir } });
  comidas$ = () => this.http.get<MetricaComida[]>(`${this.apiUrl}metricas/comidas/`);
}
