import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { HttpConfigService } from './http-config.service';
import { AuthCredentials, AuthResponse } from '../../shared/models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(private httpConfig: HttpConfigService) {}

  login(credentials: AuthCredentials): Observable<AuthResponse> {
    return this.httpConfig.post<AuthResponse>('/auth/login', credentials).pipe(
      map((response) => {
        // Normaliza createdAt si llega como string.
        return {
          ...response,
          user: {
            ...response.user,
            createdAt: new Date(response.user.createdAt)
          }
        };
      })
    );
  }
}
