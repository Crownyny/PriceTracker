import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { HttpConfigService } from './http-config.service';
import { TokenService } from './token.service';
import { UserRole } from '../../shared/models/auth.model';

export interface CreateUserRequest {
  email: string;
  password?: string;
  name?: string;
}

export interface UpdateUserRoleRequest {
  role: UserRole;
}

export interface UserRoleResponse {
  id?: string;
  role?: UserRole;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserRoleService {
  constructor(
    private http: HttpClient,
    private httpConfig: HttpConfigService,
    private tokenService: TokenService
  ) {}

  createUser(payload: CreateUserRequest): Observable<UserRoleResponse> {
    const url = `${this.httpConfig.getApiUrl()}/user`;
    return this.http.post<any>(url, payload).pipe(
      map((response) => ({
        id: response?.id,
        role: this.normalizeRole(response?.role),
        message: response?.message
      }))
    );
  }

  updateUserRole(role: UserRole): Observable<UserRoleResponse> {
    console.info('[UserRoleService] updateUserRole -> requesting role change to', role);
    const url = `${this.httpConfig.getApiUrl()}/user/role`;
    return this.http.put<any>(url, { newRole: role }).pipe(
      map((response) => {
        const normalizedRole = this.normalizeRole(response?.role) ?? role;
        this.tokenService.setUserRole(normalizedRole);
        try {
          console.info('[UserRoleService] updateUserRole -> backend response role', response?.role, 'normalized to', normalizedRole);
        } catch (e) {
          // noop
        }
        return {
          id: response?.id,
          role: normalizedRole,
          message: response?.message
        };
      })
    );
  }

  getCurrentRole(): UserRole {
    return this.tokenService.getUserRole();
  }

  canUsePremiumFeatures(): boolean {
    return this.tokenService.isPremiumUser();
  }

  /**
   * Sincroniza el rol con el backend usando PUT /user/role.
   * Envía el rol actual como payload — el backend devuelve el rol real en BD.
   * Si alguien cambió el rol externamente (Postman, admin), se actualiza localStorage.
   * Si el request falla, mantiene el rol local como fallback silencioso.
   */
  fetchAndSyncRole(): Observable<UserRole> {
    const currentRole = this.getCurrentRole();
    const url = `${this.httpConfig.getApiUrl()}/user/role`;
    return this.http.put<{ id?: string; email?: string; role?: string }>(
      url, { newRole: currentRole }
    ).pipe(
      map(response => {
        const backendRole = this.normalizeRole(response?.role) ?? currentRole;
        if (backendRole !== this.tokenService.getUserRole()) {
          this.tokenService.setUserRole(backendRole);
        }
        return backendRole;
      }),
      catchError(err => {
        // 400 "User already has role X" — el rol en BD coincide con el local, no es error real
        const msg = String(err?.error?.message ?? '').toLowerCase();
        if (err?.status === 400 && msg.includes('already has role')) {
          // El rol local es correcto — devolver sin cambios
          return of(currentRole);
        }
        // Cualquier otro error (red, auth) — usar rol local como fallback silencioso
        return of(currentRole);
      })
    );
  }

  private normalizeRole(value: unknown): UserRole | undefined {
    const role = String(value || '').toLowerCase();
    if (role === 'premium') {
      return 'premium';
    }
    if (role === 'registered') {
      return 'registered';
    }
    return undefined;
  }
}