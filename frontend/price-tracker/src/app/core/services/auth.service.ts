import { Injectable } from '@angular/core';
import { Observable, from, map, switchMap } from 'rxjs';
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

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly app: FirebaseApp;
  private readonly auth: Auth;
  private readonly googleProvider: AuthProvider;

  constructor(
    private tokenService: TokenService,
    private runtimeConfig: RuntimeConfigService,
    private extensionAuthBridge: ExtensionAuthBridgeService
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
      this.tokenService.setUserProfile(this.mapUserProfile(user));
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
          map((token) => {
            const response = this.toAuthResponse(credential.user, token);
            this.tokenService.setTokens(response.accessToken);
            this.tokenService.setUserProfile(response.user);
            this.extensionAuthBridge.publishAuthUpdate(response.accessToken, response.user.email);
            return response;
          })
        )
      )
    );
  }

  loginWithGoogle(): Observable<AuthResponse> {
    return from(signInWithPopup(this.auth, this.googleProvider)).pipe(
      switchMap((credential) =>
        from(credential.user.getIdToken()).pipe(
          map((token) => {
            const response = this.toAuthResponse(credential.user, token);
            this.tokenService.setTokens(response.accessToken);
            this.tokenService.setUserProfile(response.user);
            this.extensionAuthBridge.publishAuthUpdate(response.accessToken, response.user.email);
            return response;
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
      await signOut(this.auth);
    } finally {
      this.tokenService.clearTokens();
      this.extensionAuthBridge.publishLogout();
    }
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
      createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date()
    };
  }
}
