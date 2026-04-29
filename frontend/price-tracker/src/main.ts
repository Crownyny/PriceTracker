import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

const globalObject = globalThis as typeof globalThis & { global?: typeof globalThis };

if (!globalObject.global) {
  globalObject.global = globalThis;
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
