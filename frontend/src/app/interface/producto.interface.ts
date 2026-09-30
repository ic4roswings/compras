import { Donde } from "../enum/donde.enum";

export interface ProductoI{
    id?: number
    nombre: string
    donde: Donde
    unidades: string
    cantidad?: number
    URL?: string
    semanal?: boolean
    mensual?: boolean
    verificar?: boolean
    medida?: string
    upc?: string
}