export interface Frecuencia {
    veces: number
    primera: string
    ultima: string
    dias_desde_ultima: number
    promedio_dias: number | null
}

export interface MetricaProducto extends Frecuencia {
    nombre: string
    donde: string
}

export interface SugerenciaComida {
    comida: string
    tipo: number
    base: string | null
    dias_desde_ultima: number | null
}

export interface MetricaComida extends Frecuencia {
    comida: string
}
