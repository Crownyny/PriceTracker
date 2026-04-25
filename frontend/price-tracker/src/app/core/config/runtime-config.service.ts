import { Injectable } from '@angular/core';
import { FirebaseOptions } from 'firebase/app';

export type AppRuntimeConfig = {
  firebase: FirebaseOptions;
};

@Injectable({
  providedIn: 'root'
})
export class RuntimeConfigService {
  private config: AppRuntimeConfig | null = null;

  async load(): Promise<void> {
    if (this.config) {
      return;
    }

    const response = await fetch('/app-config.json', { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`No se pudo cargar /app-config.json (${response.status})`);
    }

    const loadedConfig = (await response.json()) as AppRuntimeConfig;
    if (!loadedConfig?.firebase?.apiKey || !loadedConfig.firebase?.authDomain || !loadedConfig.firebase?.projectId) {
      throw new Error('La configuración runtime de Firebase es inválida');
    }

    this.config = loadedConfig;
  }

  getFirebaseConfig(): FirebaseOptions {
    if (!this.config) {
      throw new Error('La configuración runtime aún no fue cargada');
    }

    return this.config.firebase;
  }
}