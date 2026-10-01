import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { BehaviorSubject, catchError, map, Observable, of, startWith } from 'rxjs';
import { DataState } from '../enum/data-state.enum';
import { AppState } from '../interface/app-state';
import { ProductoI } from '../interface/producto.interface';
import { ProductoService } from '../service/producto.service';
import { GlobalService } from '../service/global.service';
import { AgregaListaI } from '../interface/agregalista.interface';
import { Donde } from '../enum/donde.enum';
import { CabeceraComponent } from '../cabecera/cabecera.component';
import Swal from 'sweetalert2';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faPlus, faFilter, faSearch, faTimes, faChevronDown, faBolt, faUtensils, faEdit } from '@fortawesome/free-solid-svg-icons';
import { AgregarProductosComponent } from '../agregar-productos/agregar-productos.component';

@Component({
  selector: 'app-producto',
  templateUrl: './producto.component.html',
  styleUrls: ['./producto.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CabeceraComponent, FontAwesomeModule, AgregarProductosComponent]
})
export class ProductoComponent implements OnInit {

  @ViewChild('productModal') productModal: AgregarProductosComponent;
  @ViewChild('searchCheck') searchInput: ElementRef;

  // Icons
  faPlus = faPlus;
  faFilter = faFilter;
  faSearch = faSearch;
  faTimes = faTimes;
  faChevronDown = faChevronDown;
  faBolt = faBolt;
  faUtensils = faUtensils;
  faEdit = faEdit;


  isSearchActive = false;

  appState$: Observable<AppState<ProductoI[]>>
  readonly DataState = DataState
  idNum: string = ''
  private dataSubject = new BehaviorSubject<ProductoI[]>(null);
  filtro: Donde = Donde.ALL;
  todos: Donde = Donde.ALL
  carnes: Donde = Donde.CARNES
  walmart: Donde = Donde.WALMART
  costco: Donde = Donde.COSTCO
  mandado: Donde = Donde.MANDADO


  constructor(private productoService: ProductoService, private global: GlobalService, private router: Router) { }

  async ngOnInit(): Promise<void> {
    await this.global.checkTokens('productos')
    this.appState$ = this.productoService.productos$
      .pipe(
        map(response => {
          this.dataSubject.next(response);
          return { dataState: DataState.LOADED_STATE, appData: response }
        }), startWith({ dataState: DataState.LOADING_STATE }),
        catchError((error: string) => {
          return of({ dataState: DataState.ERROR_STATE, error: error })
        })
      )

  }

  filtraBusqueda(busqueda: string) {
    this.isSearchActive = !!busqueda;
    this.appState$ = this.productoService.producto_filtrado(busqueda)
      .pipe(
        map(response => {
          return { dataState: DataState.LOADED_STATE, appData: response }
        }), startWith({ dataState: DataState.LOADING_STATE }),
        catchError((error: string) => {
          return of({ dataState: DataState.ERROR_STATE, error: error })
        })
      )
  }

  agregaLista(id: number, cantidad: string, unidad: string) {
    const payload: AgregaListaI = { producto: id, cantidad: Number(cantidad), unidades: unidad };
    this.productoService.agregaLista(payload).subscribe();
    Swal.fire({
      title: 'Exito',
      text: 'Se agrego Correctamente',
      timer: 500,
      icon: 'success'
    })

  }

  filterProductos(donde: Donde): void {
    this.filtro = donde
    this.appState$ = this.productoService.filter$(donde, this.dataSubject.value)
      .pipe(
        map(response => {
          return { dataState: DataState.LOADED_STATE, appData: response }
        }), startWith({ dataState: DataState.LOADED_STATE, appData: this.dataSubject.value }),
        catchError((error: string) => {
          return of({ dataState: DataState.ERROR_STATE, error: error })
        })
      )
  }



  modiCantidad(id: number, cantidad: string, filtro: Donde) {
    const producto = this.dataSubject.value.find(p => p.id === id);
    if (producto) {
      producto.cantidad = Number(cantidad);
      this.productoService.actualizaProducto(producto, id).subscribe();
    }
  }

  editar(id: number) {
    const producto = this.dataSubject.value.find(p => p.id === id);
    if (producto) {
      this.productModal.open(producto);
    }
  }

  limpiarBusqueda(input?: HTMLInputElement) {
    if (input) input.value = '';
    this.filtraBusqueda('');
  }

  openNewModal() {
    this.productModal.open();
  }

  limpiarFiltro() {
    this.filtraBusqueda("");
  }
}
