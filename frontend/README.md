# Compras App 🛒

Una aplicación moderna para la gestión de listas de compras y catálogo de productos, desarrollada con **Angular 20**.

## 🌟 Características Modernas

### 🎨 Interfaz de Usuario "Dark Premium"
- **Tema Oscuro Universal**: Diseño sofisticado con una paleta de colores coherente (superficies profundas, acentos en rojo y dorado).
- **Glassmorphism**: Uso de efectos de desenfoque (`backdrop-filter`) y bordes vítreos en tarjetas, modales y tablas.
- **Gridentes Dinámicos**: Títulos e iconos con degradados en escala de grises para un look minimalista y elegante.
- **Micro-animaciones**: Transiciones suaves y efectos de hover para una experiencia interactiva.

### ⚡ Arquitectura Reactiva
- **Estado con RxJS**: Implementación de `BehaviorSubject` y flujos asíncronos (`appState$`) para actualizaciones de UI instantáneas y sin parpadeos.
- **Componentes Standalone**: Arquitectura moderna de Angular facilitando el mantenimiento y carga eficiente.

### 🛠️ Funcionalidades Clave
- **Gestión de Catálogo**: Agregar y editar productos con validaciones robustas para campos booleanos y valores por defecto.
- **Listas Inteligentes**: Creación de listas de compras con filtrado avanzado por tienda (Walmart, Mandado, Carnes, Costco).
- **Planificación Semanal**: Gestión reactiva de productos semanales con sincronización automática a la lista principal.
- **Modales Modernizados**: Flujos optimizados (cierre automático al guardar) y etiquetas con visibilidad mejorada.

## 🚀 Requisitos Previos

- **Node.js**: Versión `22.12.0` (recomendado usar `nvm`)
- **Angular CLI**: Versión `20.x`

## 🛠️ Stack Tecnológico

- **Frontend**: [Angular 20](https://angular.io/)
- **Estilos**: Vanilla CSS / SCSS con diseño personalizado.
- **Componentes UI**: [Bootstrap 5](https://getbootstrap.com/) (como base para layouts).
- **Iconos**: [Font Awesome 6](https://fontawesome.com/).
- **Notificaciones**: [SweetAlert2](https://sweetalert2.github.io/).

## 💻 Desarrollo

### Servidor de Desarrollo
Corre `npm start` para iniciar un servidor local. Navega a `http://localhost:4200/`.

### Construcción (Build)
Corre `npm run build` para generar los artefactos de producción en el directorio `dist/`.

---
*Generado y mantenido con mejoras de visuales y de rendimiento continuas.*
