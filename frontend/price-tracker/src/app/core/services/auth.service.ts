import { Injectable } from '@angular/core';
import { Observable, from, map, switchMap, catchError, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import {
  Auth,
  AuthProvider,
  User,
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { AuthCredentials, AuthResponse } from '../../shared/models/auth.model';
import { TokenService } from './token.service';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { ExtensionAuthBridgeService } from './extension-auth-bridge.service';
import { HttpConfigService } from './http-config.service';
import { UserRoleService } from './user-role.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly app: FirebaseApp;
  private readonly auth: Auth;
  private readonly googleProvider: AuthProvider;

  constructor(
    private http: HttpClient,
    private httpConfig: HttpConfigService,
    private tokenService: TokenService,
    private runtimeConfig: RuntimeConfigService,
    private extensionAuthBridge: ExtensionAuthBridgeService,
    private userRoleService: UserRoleService
  ) {
    const firebaseConfig = this.runtimeConfig.getFirebaseConfig();
    this.app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    this.auth = getAuth(this.app);
    this.googleProvider = new GoogleAuthProvider();

    // Mantiene sincronizados token/perfil en localStorage cuando Firebase renueva sesión.
    onIdTokenChanged(this.auth, async (user) => {
      if (!user) {
        this.tokenService.clearTokens();
        return;
      }

      const token = await user.getIdToken();
      this.tokenService.setTokens(token);

      // Preservar el rol ya guardado — no sobreescribir con el default de mapUserProfile.
      // Si no hay perfil guardado aún, guardar el perfil base (el rol se actualizará
      // cuando el login/register llame al backend).
      const existingProfile = this.tokenService.getUserProfile();
      if (!existingProfile) {
        this.tokenService.setUserProfile(this.mapUserProfile(user));
      } else {
        // Solo actualizar campos de identidad, preservar el rol
        this.tokenService.setUserProfile({
          ...existingProfile,
          id: user.uid,
          email: user.email ?? existingProfile.email,
          name: user.displayName ?? existingProfile.name,
          avatar: user.photoURL ?? existingProfile.avatar,
        });
      }

      this.extensionAuthBridge.publishAuthUpdate(token, user.email ?? undefined);
    });
  }

  login(credentials: AuthCredentials): Observable<AuthResponse> {
    return from(signInWithEmailAndPassword(this.auth, credentials.email, credentials.password)).pipe(
      switchMap((credential) =>
        from(credential.user.getIdToken()).pipe(
          map((token) => {
            const response = this.toAuthResponse(credential.user, token);
            this.tokenService.setTokens(response.accessToken);
            this.tokenService.setUserProfile(response.user);
            this.extensionAuthBridge.publishAuthUpdate(response.accessToken, response.user.email);
            // El rol se sincroniza desde Mi Cuenta (PUT /api/v1/user/role).
            // No llamamos createUser aquí porque ese endpoint solo crea usuarios
            // nuevos y rechaza con 400 si el email ya existe.
            return response;
          })
        )
      )
    );
  }

  register(credentials: AuthCredentials & { displayName?: string }): Observable<AuthResponse> {
    return from(createUserWithEmailAndPassword(this.auth, credentials.email, credentials.password)).pipe(
      switchMap((credential) =>
        from(credential.user.getIdToken()).pipe(
          switchMap((token) => {
            const response = this.toAuthResponse(credential.user, token);
            this.tokenService.setTokens(response.accessToken);
            this.tokenService.setUserProfile(response.user);
            this.extensionAuthBridge.publishAuthUpdate(response.accessToken, response.user.email);

            // Crea usuario en backend (endpoint existente) y guarda rol base.
            return this.userRoleService.createUser({
              email: response.user.email,
              name: credentials.displayName
            }).pipe(
              map((created) => {
                if (created.role) {
                  this.tokenService.setUserRole(created.role);
                }
                return response;
              }),
              catchError(() => of(response))
            );
          })
        )
      )
    );
  }

  loginWithGoogle(): Observable<AuthResponse> {
    return from(signInWithPopup(this.auth, this.googleProvider)).pipe(
      switchMap((credential) =>
        from(credential.user.getIdToken()).pipe(
          switchMap((token) => {
            const response = this.toAuthResponse(credential.user, token);
            this.tokenService.setTokens(response.accessToken);
            this.tokenService.setUserProfile(response.user);
            this.extensionAuthBridge.publishAuthUpdate(response.accessToken, response.user.email);

            return this.userRoleService.createUser({
              email: response.user.email,
              name: response.user.name
            }).pipe(
              map((created) => {
                if (created.role) {
                  this.tokenService.setUserRole(created.role);
                }
                return response;
              }),
              catchError(() => of(response))
            );
          })
        )
      )
    );
  }

  resetPassword(email: string): Observable<void> {
    return from(sendPasswordResetEmail(this.auth, email));
  }

  async logout(): Promise<void> {
    try {
      const token = this.tokenService.getToken();
      if (token) {
        // Endpoint existente: invalidación de token/sesión backend.
        this.invalidateToken(token).subscribe({
          error: (err) => console.warn('Token invalidate failed:', err)
        });
      }
      await signOut(this.auth);
    } finally {
      this.tokenService.clearTokens();
      this.extensionAuthBridge.publishLogout();
    }
  }

  validateToken(token?: string): Observable<{ valid: boolean; message?: string }> {
    const accessToken = token || this.tokenService.getToken() || '';
    const url = `${this.httpConfig.getApiBaseUrl()}/auth/validate`;
    return this.http.post<any>(url, { token: accessToken }).pipe(
      map((response) => ({
        valid: Boolean(response?.valid ?? response?.isValid ?? response?.success),
        message: response?.message
      }))
    );
  }

  invalidateToken(token?: string): Observable<{ success: boolean; message?: string }> {
    const accessToken = token || this.tokenService.getToken() || '';
    const url = `${this.httpConfig.getApiBaseUrl()}/auth/invalidate`;
    return this.http.post<any>(url, { token: accessToken }).pipe(
      map((response) => ({
        success: Boolean(response?.success ?? true),
        message: response?.message
      }))
    );
  }

  private toAuthResponse(user: User, accessToken: string): AuthResponse {
    return {
      accessToken,
      refreshToken: user.refreshToken,
      expiresIn: 3600,
      user: this.mapUserProfile(user)
    };
  }

  private mapUserProfile(user: User) {
    return {
      id: user.uid,
      email: user.email ?? '',
      name: user.displayName ?? undefined,
      avatar: user.photoURL ?? undefined,
      createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date(),
      role: this.userRoleService.getCurrentRole()
    };
  }
}