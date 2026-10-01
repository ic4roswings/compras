import { ChangeDetectorRef, Component, ElementRef, EventEmitter, OnInit, Output, ViewChild, Input } from '@angular/core';

import { FormsModule, NgForm } from '@angular/forms';
import { ProductoService } from '../service/producto.service';
import Swal from 'sweetalert2';

declare var bootstrap: any;

@Component({
    selector: 'app-agregar-productos',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './agregar-productos.component.html',
    styleUrls: ['./agregar-productos.component.css']
})
export class AgregarProductosComponent implements OnInit {

    @ViewChild('closeModalBtn') closeModalBtn: ElementRef;
    @ViewChild('productModal') modalElement: ElementRef;
    @Output() saved = new EventEmitter<void>();
    // Se emite cuando el modal se cierra sin guardar (X, Cancelar, etc.)
    @Output() cancelled = new EventEmitter<void>();
    @Input() showDelete: boolean = false;

    isEditing: boolean = false;
    selectedProductId: number | null = null;
    urlError: string = '';
    initialData: any = {
        nombre: '',
        donde: 'Walmart',
        cantidad: 0,
        unidades: 'PZ',
        medida: 'QT',
        upc: '',
        URL: '',
        semanal: false,
        mensual: false,
        verificar: false
    };

    private modal: any;
    private guardado = false;

    constructor(private productoService: ProductoService, private cdr: ChangeDetectorRef) { }

    ngOnInit(): void {
    }

    open(producto?: any) {
        this.urlError = '';
        if (producto) {
            this.isEditing = true;
            this.selectedProductId = producto.id;
            this.initialData = { ...producto };
        } else {
            this.isEditing = false;
            this.selectedProductId = null;
            this.initialData = {
                nombre: '',
                donde: 'Walmart',
                cantidad: 0,
                unidades: 'PZ',
                medida: 'QT',
                upc: '',
                URL: '',
                semanal: false,
                mensual: false,
                verificar: false
            };
        }

        // Sin zone.js, abrirlo desde fuera de un evento (p. ej. tras un SweetAlert) no dispara la
        // detección de cambios: se fuerza para que el formulario muestre los datos desde la primera vez
        this.cdr.detectChanges();

        if (!this.modal) {
            this.modal = new bootstrap.Modal(this.modalElement.nativeElement);
            this.modalElement.nativeElement.addEventListener('hidden.bs.modal', () => {
                if (!this.guardado) {
                    this.cancelled.emit();
                }
                this.guardado = false;
            });
        }
        this.guardado = false;
        this.modal.show();
    }

    close() {
        this.modal?.hide();
    }

    onDelete() {
        if (this.selectedProductId) {
            Swal.fire({
                title: '¿Estás seguro?',
                text: '¡Esto eliminará el producto permanentemente del catálogo!',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: 'var(--primary)',
                cancelButtonColor: 'var(--secondary)',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar',
                background: 'var(--surface-color)',
                color: 'var(--text-primary)'
            }).then((result) => {
                if (result.isConfirmed) {
                    this.productoService.borraProducto(this.selectedProductId!).subscribe({
                        next: () => {
                            this.guardado = true;
                            this.close();
                            this.saved.emit();
                            Swal.fire({
                                title: 'Eliminado',
                                text: 'El producto ha sido eliminado del catálogo.',
                                icon: 'success',
                                timer: 1000,
                                showConfirmButton: false
                            });
                        },
                        error: (error) => {
                            Swal.fire('Error', 'No se pudo eliminar el producto', 'error');
                        }
                    });
                }
            });
        }
    }

    guardaProducto(form: NgForm) {
        const values = form.value;
        this.urlError = '';

        // Walmart guarda solo la ruta: si se pegó la URL completa, se le quita el dominio
        if (values.donde === 'Walmart' && typeof values.URL === 'string') {
            values.URL = values.URL.trim().replace(/^https?:\/\/(www\.)?super\.walmart\.com\.mx/i, '');
        }

        // Strict Validation for Walmart
        if (values.donde === 'Walmart') {
            if (!values.URL || values.URL === '-' || values.URL.trim() === '') {
                this.urlError = 'La URL es obligatoria para productos de Walmart';
                return; // Do not save
            }
        }

        // Normalize booleans
        values.semanal = !!values.semanal;
        values.mensual = !!values.mensual;
        values.verificar = !!values.verificar;

        // Normalize strings to match backend expectations
        if (!values.upc) values.upc = '-';
        if (!values.URL) values.URL = '-';
        if (!values.medida) values.medida = 'QT';

        const request = this.isEditing && this.selectedProductId
            ? this.productoService.actualizaProducto(values, this.selectedProductId)
            : this.productoService.guardaProducto([values]);

        request.subscribe({
            next: (response) => {
                this.guardado = true;
                this.close();

                Swal.fire({
                    title: 'Exito',
                    text: this.isEditing ? 'Producto actualizado' : 'Producto guardado',
                    timer: 500,
                    icon: 'success',
                    showConfirmButton: false
                });

                this.saved.emit();
                form.resetForm({
                    donde: 'Walmart',
                    unidades: 'PZ',
                    medida: 'QT'
                });
            },
            error: (error) => {
                Swal.fire('Error', this.isEditing ? 'No se pudo actualizar el producto' : 'No se pudo guardar el producto', 'error');
            }
        });
    }
}
