from django.http import Http404

RUTA_ADMIN = '/portal-secreto'
IPS_LOCALES = {'127.0.0.1', '::1'}
# Cualquier proxy (NPM, Cloudflare, nginx) agrega alguna de estas cabeceras. Un cliente
# puede falsificarlas, pero solo consigue que lo rechacemos: nunca sirven para entrar.
CABECERAS_PROXY = (
    'HTTP_X_FORWARDED_FOR',
    'HTTP_X_FORWARDED_HOST',
    'HTTP_X_REAL_IP',
    'HTTP_FORWARDED',
    'HTTP_CF_CONNECTING_IP',
)


class RestrictAdminByIpMiddleware:
    """
    Restringe /portal-secreto/ (el admin de Django) a conexiones locales.

    Solo deja pasar si la conexión TCP viene de loopback (REMOTE_ADDR, que el cliente no
    puede falsificar) y no trae cabeceras de proxy. Todo lo demás recibe 404 para no
    revelar que la ruta existe.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == RUTA_ADMIN or request.path.startswith(RUTA_ADMIN + '/'):
            vino_por_proxy = any(request.META.get(h) for h in CABECERAS_PROXY)
            if vino_por_proxy or request.META.get('REMOTE_ADDR') not in IPS_LOCALES:
                raise Http404()
        return self.get_response(request)
