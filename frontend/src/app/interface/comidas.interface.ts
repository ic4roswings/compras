import { ProductoI } from "./producto.interface"

export interface Comidas {
    id?: number
    comida?: string
    tipo?: number
    base?: string | null
    producto?: ProductoI
    cantidad?: number
    unidades?: string
}
