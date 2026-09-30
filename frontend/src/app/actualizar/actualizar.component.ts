import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { BehaviorSubject, Observable, catchError, map, of, startWith } from 'rxjs';
import { AppState } from '../interface/app-state';
import { ProductoI } from '../interface/producto.interface';
import { DataState } from '../enum/data-state.enum';
import { ProductoService } from '../service/producto.service';
import { GlobalService } from '../service/global.service';
import { CabeceraComponent } from '../cabecera/cabecera.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-actualizar',
  templateUrl: './actualizar.component.html',
  styleUrls: ['./actualizar.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CabeceraComponent]
})
export class ActualizarComponent implements OnInit {

  numero: number;
  number: string;
  appState$: Observable<AppState<ProductoI>>
  readonly DataState = DataState
  private dataSubject = new BehaviorSubject<ProductoI>(null);


  constructor(private route: ActivatedRoute, private productoService: ProductoService, private router: Router, private global: GlobalService) { }

  async ngOnInit(): Promise<void> {
    this.number = this.route.snapshot.paramMap.get('numero');
    await this.global.checkTokens('actualizar/' + this.number)
    this.numero = +this.number;
    this.appState$ = this.productoService.producto(this.numero)
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


  actualizaProducto(form: NgForm) {
    const values = form.value;

    // Normalize booleans robustly
    values.semanal = !!values.semanal;
    values.verificar = !!values.verificar;
    values.mensual = !!values.mensual;

    // Normalize strings
    if (!values.upc) values.upc = '-';
    if (!values.URL) values.URL = '-';
    if (!values.medida) values.medida = '-';

    this.productoService.actualizaProducto(values, this.numero)
      .subscribe(
        (response => {
          return { dataState: DataState.LOADED_STATE, appData: response }
        })
      )
    Swal.fire({
      title: 'Exito',
      text: 'Se agrego Correctamente',
      timer: 500,
      icon: 'success'
    })

    this.router.navigate(['/productos']);
  }

  regresa() {
    this.router.navigate(['/productos']);
  }

}
