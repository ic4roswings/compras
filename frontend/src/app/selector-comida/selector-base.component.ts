import { Component, ChangeDetectionStrategy, computed, input, output, signal } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faDrumstickBite, faChevronDown, faSearch, faPlus } from '@fortawesome/free-solid-svg-icons';

const normaliza = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Selector de la base de una comida (pollo, res...): elige del catálogo o crea una nueva escribiéndola
@Component({
  selector: 'app-selector-base',
  templateUrl: './selector-base.component.html',
  styleUrls: ['./selector-comida.component.css'],
  standalone: true,
  imports: [FontAwesomeModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectorBaseComponent {
  valor = input<string>('');
  bases = input<string[]>([]);
  // Muestra la opción "Sin base" (para comidas ya existentes, donde vacío significa quitarla)
  permiteQuitar = input<boolean>(false);
  vacio = input<string>('Sin base');
  // Dentro de un modal con scroll el menú debe posicionarse en fixed para no recortarse
  fijo = input<boolean>(false);
  cambia = output<string>();

  faDrumstickBite = faDrumstickBite;
  faChevronDown = faChevronDown;
  faSearch = faSearch;
  faPlus = faPlus;

  busqueda = signal('');
  popper = computed(() => this.fijo() ? '{"strategy":"fixed"}' : null);

  filtradas = computed(() => {
    const q = normaliza(this.busqueda());
    return q ? this.bases().filter(b => normaliza(b).includes(q)) : this.bases();
  });

  // Hay texto escrito que no coincide exactamente con ninguna base del catálogo
  puedeCrear = computed(() => {
    const q = normaliza(this.busqueda());
    return q.length > 0 && !this.bases().some(b => normaliza(b) === q);
  });

  elige(base: string) {
    this.cambia.emit(base);
    this.busqueda.set('');
  }

  crea() {
    this.elige(this.busqueda().trim());
  }

  onEnter() {
    if (this.puedeCrear() && this.filtradas().length === 0) {
      this.crea();
    } else if (this.filtradas().length > 0) {
      this.elige(this.filtradas()[0]);
    }
  }
}
