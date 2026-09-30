import { ProductoI } from "./producto.interface"

export interface Comidas {
    id?: number
    comida?: string
    producto?: ProductoI
    cantidad?: number
    unidades?: string
}
