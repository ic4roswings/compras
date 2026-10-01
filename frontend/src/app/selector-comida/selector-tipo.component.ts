import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCalendarDay, faChevronDown } from '@fortawesome/free-solid-svg-icons';

// Selector del tipo de comida (1 entre semana, 2 fin de semana) con el estilo de los filtros de la app
@Component({
  selector: 'app-selector-tipo',
  templateUrl: './selector-tipo.component.html',
  styleUrls: ['./selector-comida.component.css'],
  standalone: true,
  imports: [FontAwesomeModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectorTipoComponent {
  valor = input<number>(1);
  // Dentro de un modal con scroll el menú debe posicionarse en fixed para no recortarse
  fijo = input<boolean>(false);
  cambia = output<number>();

  faCalendarDay = faCalendarDay;
  faChevronDown = faChevronDown;

  etiqueta = computed(() => this.valor() === 2 ? 'Fin de semana' : 'Entre semana');
  popper = computed(() => this.fijo() ? '{"strategy":"fixed"}' : null);
}
