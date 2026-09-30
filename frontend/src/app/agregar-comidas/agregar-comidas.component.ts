import { Component, OnInit, ViewChild, ElementRef, Input, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, map, of, startWith } from 'rxjs';
import { AppState } from '../interface/app-state';
import { ProductoI } from '../interface/producto.interface';
import { DataState } from '../enum/data-state.enum';
import { FormsModule, NgForm } from '@angular/forms';
import { ProductoService } from '../service/producto.service';
import { GlobalService } from '../service/global.service';
import Swal from 'sweetalert2';
import { ComidasService } from '../service/comidas.service';
import { Comidas } from '../interface/comidas.interface';
import { AgregaComida } from '../interface/agrega-comida.interface';
import { CabeceraComponent } from '../cabecera/cabecera.component';

declare var bootstrap: any;

@Component({
  selector: 'app-agregar-comidas',
  templateUrl: './agregar-comidas.component.html',
  styleUrls: ['./agregar-comidas.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CabeceraComponent]
})
export class AgregarComidasComponent implements OnInit {

  @ViewChild('comidaModal') modalElement: ElementRef;
  @Input() isModal: boolean = false;
  @Output() saved = new EventEmitter<void>();

  private modal: any;

  numero: number;
  number: string;
  isEditing: boolean = false;
  productoNombre: string = '';
  appState$: Observable<AppState<Comidas>>
  comida: any = '';
  comidas: any[] = [];
  comidaSeleccionada: string = '';
  cantidad: number = 1;
  unidades: string = 'PZ';
  readonly DataState = DataState
  private dataSubject = new BehaviorSubject<Comidas>(null);
  isLoading = false;


  constructor(private route: ActivatedRoute, private comidasService: ComidasService, private router: Router, private global: GlobalService) { }

  async ngOnInit(): Promise<void> {
    if (!this.isModal) {
      this.number = await this.getNumero()
      this.numero = +this.route.snapshot.paramMap.get('numero');

      if (this.route.snapshot.paramMap.has('comida') &&
        this.route.snapshot.paramMap.has('cantidad') &&
        this.route.snapshot.paramMap.has('unidades')) {

        this.comida = this.route.snapshot.paramMap.get('comida');
        this.cantidad = +this.route.snapshot.paramMap.get('cantidad');
        this.unidades = this.route.snapshot.paramMap.get('unidades');
        this.appState$ = this.comidasService.producto2(this.numero, this.comida, this.cantidad, this.unidades)
          .pipe(
            map(response => {
              this.dataSubject.next(response);
              return { dataState: DataState.LOADED_STATE, appData: response }
            }), startWith({ dataState: DataState.LOADING_STATE }),
            catchError((error: string) => {
              return of({ dataState: DataState.ERROR_STATE, error: error })
            })
          )

      } else {
        await this.global.checkTokens('agregarComidas/' + this.number)
        this.appState$ = this.comidasService.producto(this.numero)
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
    }
    this.cargarComidas();
  }

  cargarComidas(): void {
    this.comidasService.obtenerComidasUnicas().subscribe(
      (data) => {
        this.comidas = data;
      },
      (error) => {
        console.error('Error al cargar las comidas:', error);
      }
    );
  }

  // Modal Methods
  open(productoId: number, productoNombre: string, initialData?: any) {
    this.isModal = true;
    this.isEditing = !!initialData;
    this.numero = productoId;
    this.number = productoId.toString();
    this.productoNombre = productoNombre;

    // Mock an active state for the modal view
    this.appState$ = of({
      dataState: DataState.LOADED_STATE,
      appData: {
        producto: { nombre: productoNombre },
        cantidad: initialData?.cantidad || 1,
        unidades: initialData?.unidades || 'PZ'
      } as any
    });

    if (initialData) {
      this.comida = initialData.comida;
      this.cantidad = initialData.cantidad;
      this.unidades = initialData.unidades;
    } else {
      this.resetForm();
    }

    if (!this.modal) {
      this.modal = new bootstrap.Modal(this.modalElement.nativeElement);
    }
    this.modal.show();
  }

  close() {
    this.modal?.hide();
  }

  resetForm() {
    this.isEditing = false;
    this.comida = '';
    this.cantidad = 1;
    this.unidades = 'PZ';
  }

  onComidaChange() {
    console.log("Comida seleccionada:", this.comida);
  }

  async getNumero(): Promise<string> {
    return this.route.snapshot.paramMap.get('numero');
  }

  actualizaProducto(form: NgForm) {
    console.log(form.value);
    this.isLoading = true;

    const payload: AgregaComida = {
      comida: form.value.comida || form.value.comida_nueva,
      producto: Number(this.number),
      cantidad: form.value.cantidad,
      unidades: form.value.unidades
    };

    this.comidasService.agregaAComida(payload)
      .subscribe({
        next: (response => {
          this.isLoading = false;
          Swal.fire({
            title: 'Éxito',
            text: 'Se agregó correctamente',
            timer: 500,
            icon: 'success',
            showConfirmButton: false
          });

          if (this.isModal) {
            this.close();
            this.saved.emit();
          } else {
            if (this.route.snapshot.paramMap.has('comida') &&
              this.route.snapshot.paramMap.has('cantidad') &&
              this.route.snapshot.paramMap.has('unidades')) {
              this.router.navigate([`/comidas/${this.route.snapshot.paramMap.get('comida')}`]);
            } else {
              this.router.navigate(['/productos']);
            }
          }
        }),
        error: (error) => {
          this.isLoading = false;
          Swal.fire('Error', 'No se pudo guardar la comida', 'error');
        }
      });
  }

  regresa() {
    if (this.isModal) {
      this.close();
    } else {
      this.router.navigate(['/productos']);
    }
  }

}
