"""compras URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, include
from compras import apiViews
from rest_framework.urlpatterns import format_suffix_patterns
from django.conf import settings
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView


urlpatterns = [
    path('portal-secreto/', admin.site.urls),
    path('productos/', apiViews.ProductoListView.as_view(), name='productos_list'),
    path('productos/<int:id>', apiViews.ProductoDetailView.as_view(), name='producto_detail'),
    path('productos/<str:nombre>',apiViews.ProductoFiltradoView.as_view(), name='producto_filtrado'),
    path('pendientes/', apiViews.PendienteListView.as_view(), name='pendiente_list'),
    path('pendientes/<int:id>', apiViews.PendienteDetailView.as_view(), name='pendiente_detail'),
    path('filtrado/<int:identifica>', apiViews.ProductoFiltradoParametroView.as_view(), name='producto_filtrado_parametro'),
    path('lista/', apiViews.ListaListView.as_view(), name='lista_list'),
    path('damelista/', apiViews.GeneraListaView.as_view(), name ='genera_lista'),
    path('dameEncargado/', apiViews.GeneraEncargadoView.as_view(), name ='genera_encargado'),
    path('borraEncargado/<int:id>', apiViews.EncargadoDetailView.as_view(), name='encargado_list'),
    path('modificaEncargado/<int:id>', apiViews.EncargadoUpdateView.as_view(), name='modifica_encargado'),
    path('walmart/', apiViews.GeneraListaWalmartView.as_view(), name='genera_lista_walmart'),
    path('login/', apiViews.LoginView.as_view(), name='login'),
    path('lista/<int:id>', apiViews.ListaDetailView.as_view(), name='lista_detail'),
    path('comidas/', apiViews.ComidasUnicasView.as_view(), name ='comidas'),
    path('agregaComidas/', apiViews.AgregaComidaView.as_view(), name='agrega_comida'),
    path('dameComidas/<str:comida>/', apiViews.GeneraComidaView.as_view(), name ='genera_comida'),
    path('borraComidas/<str:comida>/<int:id>', apiViews.BorraComidaView.as_view(), name ='borra_comida'),
    path('bases/', apiViews.BasesComidaView.as_view(), name='bases_comida'),
    path('comidas/<str:comida>/base/', apiViews.CambiaBaseComidaView.as_view(), name='comida_base'),
    path('comidas/<str:comida>/tipo/', apiViews.CambiaTipoComidaView.as_view(), name='comida_tipo'),
    path('comidas/<str:comida>/hecha/', apiViews.RegistraComidaHechaView.as_view(), name='comida_hecha'),
    path('metricas/productos/', apiViews.MetricasProductosView.as_view(), name='metricas_productos'),
    path('sugerencias/comidas/', apiViews.SugerenciasComidasView.as_view(), name='sugerencias_comidas'),
    path('metricas/comidas/', apiViews.MetricasComidasView.as_view(), name='metricas_comidas'),
    path('comidas/<str:comida>/', apiViews.BorraComidaCompletaView.as_view(), name ='borra_comida_completa'),
    path('vectores/estado/', apiViews.VectoresEstadoView.as_view(), name='vectores_estado'),
    path('vectores/sync/', apiViews.VectoresSincronizarView.as_view(), name='vectores_sync'),
    path('lista/delete', apiViews.ListaDeleteView.as_view(), name='lista_delete'),
    path('lista/deletenc', apiViews.ListaDeleteNoCostcoView.as_view(), name='lista_deletenc'),
    path('lista/addenc', apiViews.ListaAddEncargadoView.as_view(), name='lista_addenc'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('gastos/crearOperacion/', apiViews.CrearOperacionView.as_view(), name='crear-operacion'),
    path('gastos/resumenCategorias/', apiViews.ResumenPorCategoriaView.as_view(), name='resumen-categorias'),
    path('gastos/resumenCategorias/<str:periodo>/', apiViews.ResumenPorCategoriaView.as_view(), name='resumen-categorias'),
    path('gastos/periodos/', apiViews.PeriodosView.as_view(), name='periodos'),
    path('gastos/operacionesPeriodo/<str:categoria>/', apiViews.OperacionesPorPeriodoView.as_view(), name='operaciones-por-periodo'),
    path('gastos/operacionesPeriodo/<str:categoria>/<str:periodo>/', apiViews.OperacionesPorPeriodoView.as_view(), name='operaciones-por-periodo'),
    path('gastos/actualizaCategoria/', apiViews.ActualizarCategoriaView.as_view(), name='actualiza-categorias'),
    path('gastos/eliminaGasto/', apiViews.EliminarOperacionView.as_view(), name='eliminaOperacion'),
    path('gastos/gastoAMeses/', apiViews.DividirOperacionEnMesesView.as_view(), name='gastoMeses'),
]
#   path('api-token-auth/', atviews.obtain_auth_token),
urlpatterns = format_suffix_patterns(urlpatterns)

if settings.DEBUG:
    import debug_toolbar
    urlpatterns += path('__debug__/', include('debug_toolbar.urls')),
