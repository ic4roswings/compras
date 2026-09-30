import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { HttpStatusError, LoginService } from './service/login.service';
import { GlobalService } from './service/global.service';

const conToken = (req: HttpRequest<unknown>, token: string) =>
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const login = inject(LoginService);
    const global = inject(GlobalService);
    // login/ y token/* no llevan Authorization: un token vencido ahí haría fallar con 401
    const esAuth = /\/(login|token)\//.test(req.url);
    const token = localStorage.getItem('token');

    return next(token && !esAuth ? conToken(req, token) : req).pipe(
        catchError(error => {
            if (error.status !== 401 || esAuth) {
                return throwError(() => error);
            }
            // 401: renueva el token y repite la petición original
            return login.renovar().pipe(
                switchMap(nuevo => next(conToken(req, nuevo))),
                catchError(err => {
                    if (err instanceof HttpStatusError && (err.status === 400 || err.status === 401)) {
                        global.salir();
                    }
                    return throwError(() => err);
                })
            );
        })
    );
};
