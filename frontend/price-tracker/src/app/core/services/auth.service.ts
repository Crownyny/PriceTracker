import { Injectable } from '@angular/core';
import { Observable, from, map, switchMap } from 'rxjs';
import {
  Auth,
  User,
  getAuth,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { AuthCredentials, AuthResponse } from '../../shared/models/auth.model';
import { TokenService } from './token.service';
import { firebaseConfig } from '../config/firebase.config';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly app: FirebaseApp;
  private readonly auth: Auth;

  constructor(private tokenService: TokenService) {
    this.app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    this.auth = getAuth(this.app);

    // Mantiene sincronizados token/perfil en localStorage cuando Firebase renueva sesión.
    onIdTokenChanged(this.auth, async (user) => {
      if (!user) {
        this.tokenService.clearTokens();
        return;
      }

      const token = await user.getIdToken();
      this.tokenService.setTokens(token, user.refreshToken);
      this.tokenService.setUserProfile(this.mapUserProfile(user));
    });
  }

  login(credentials: AuthCredentials): Observable<AuthResponse> {
    return from(signInWithEmailAndPassword(this.auth, credentials.email, credentials.password)).pipe(
      switchMap((credential) =>
        from(credential.user.getIdToken()).pipe(
          map((token) => {
            const response = this.toAuthResponse(credential.user, token);
            this.tokenService.setTokens(response.accessToken, response.refreshToken);
            this.tokenService.setUserProfile(response.user);
            return response;
          })
        )
      )
    );
  }

  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
    } finally {
      this.tokenService.clearTokens();
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
