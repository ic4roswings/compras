import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ProductoComponent } from './producto/producto.component';
import { ListaComponent } from './lista/lista.component';
import { SemanalComponent } from './semanal/semanal.component';
import { ComidasComponent } from './comidas/comidas.component';
import { AgregarComidasComponent } from './agregar-comidas/agregar-comidas.component';
import { EncargadoComponent } from './encargado/encargado.component';
import { ActualizarComponent } from './actualizar/actualizar.component';
import { PendientesComponent } from './pendientes/pendientes.component';
import { ChecklistComponent } from './checklist/checklist.component';
import { MetricasComponent } from './metricas/metricas.component';

export const routes: Routes = [
    { path: '', component: LoginComponent },
    { path: 'login', component: LoginComponent },
    { path: 'productos', component: ProductoComponent },
    { path: 'lista', component: ListaComponent },
    { path: 'semanal', component: SemanalComponent },
    { path: 'comidas', component: ComidasComponent },
    { path: 'comidas/:comida', component: ComidasComponent },
    { path: 'agregarComidas/:numero', component: AgregarComidasComponent },
    { path: 'agregarComidas/:numero/:comida/:cantidad/:unidades', component: AgregarComidasComponent },
    { path: 'encargado', component: EncargadoComponent },
    { path: 'checklist', component: ChecklistComponent },
    { path: 'actualizar/:numero', component: ActualizarComponent },
    { path: 'pendientes', component: PendientesComponent },
    { path: 'metricas', component: MetricasComponent },

];
