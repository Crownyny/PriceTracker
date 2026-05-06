import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TokenService } from '../services/token.service';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(
    private tokenService: TokenService,
    private router: Router
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.tokenService.getToken();

    if (token && request.url.includes('/api')) {
      request = request.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      });
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          // Token expirado o inválido — limpiar sesión y redirigir al login
          console.warn('[AuthInterceptor] 401 recibido — sesión expirada, redirigiendo al login');
          this.tokenService.clearTokens();
          this.router.navigate(['/login'], {
            queryParams: { returnUrl: this.router.url }
          });
        }
        // SIEMPRE re-lanzar el error para que los componentes puedan
        // reaccionar en su propio error handler y quitar el estado loading.
        return throwError(() => error);
      })
    );
  }
}