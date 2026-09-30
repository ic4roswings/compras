import { ProductoI } from "./producto.interface"

export interface ListaI{
    id?: number
    producto?: ProductoI
    cantidad?: number
    unidades?: string
}