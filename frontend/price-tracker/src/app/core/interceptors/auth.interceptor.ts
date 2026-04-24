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

/**
 * HTTP Interceptor - Añade automáticamente el token JWT a las peticiones
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private tokenService: TokenService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Obtén el token
    const token = this.tokenService.getToken();

    // Si existe token y la petición es a la API, añádelo al header
    if (token && request.url.includes('/api')) {
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // Manejo de errores 401 (token expirado)
        if (error.status === 401) {
          this.tokenService.clearTokens();
          // Aquí podrías redirigir a login
          console.error('Token expirado, usuario deslogueado');
        }

        return throwError(() => error);
      })
    );
  }
}
