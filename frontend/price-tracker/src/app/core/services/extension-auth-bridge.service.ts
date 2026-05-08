import { Injectable } from '@angular/core';
import { TokenService } from './token.service';

type ExtensionAuthStateMessage = {
  source: 'pricetracker-extension';
  type: 'AUTH_STATE';
  token: string | null;
  email: string | null;
};

@Injectable({
  providedIn: 'root'
})
export class ExtensionAuthBridgeService {
  constructor(private tokenService: TokenService) {
    window.addEventListener('message', this.handleMessage);
    this.requestState();
  }

  publishAuthUpdate(token: string, email?: string): void {
    window.postMessage(
      {
        source: 'pricetracker-dashboard',
        type: 'AUTH_UPDATE',
        token,
        email: email ?? null
      },
      window.location.origin
    );
  }

  publishLogout(): void {
    window.postMessage(
      {
        source: 'pricetracker-dashboard',
        type: 'AUTH_LOGOUT'
      },
      window.location.origin
    );
  }

  requestState(): void {
    window.postMessage(
      {
        source: 'pricetracker-dashboard',
        type: 'AUTH_REQUEST_STATE'
      },
      window.location.origin
    );
  }

  private handleMessage = (event: MessageEvent): void => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }

    const data = event.data as ExtensionAuthStateMessage;
    if (!data || data.source !== 'pricetracker-extension' || data.type !== 'AUTH_STATE') {
      return;
    }

    if (!data.token) {
      this.tokenService.clearTokens();
      return;
    }

    this.tokenService.setTokens(data.token);
    this.tokenService.setUserProfile({
      id: this.extractSubject(data.token) || '',
      email: data.email || '',
      name: data.email || 'Extension User',
      createdAt: new Date().toISOString()
    });
  };

  private extractSubject(token: string): string | null {
    const payload = this.tokenService.decodeToken(token);
    return payload?.sub ?? payload?.user_id ?? null;
  }
}
