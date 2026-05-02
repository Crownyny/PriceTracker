import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  StompWebSocketService,
  ProductMessage,
  ErrorMessage,
  StatusMessage
} from './stomp-websocket.service';

/**
 * WebSocketService (wrapper)
 *
 * Requerido por la entrega: `websocket.service.ts`.
 * Implementación real vive en `StompWebSocketService` (STOMP + SockJS).
 */
@Injectable({ providedIn: 'root' })
export class WebsocketService {
  constructor(private readonly stomp: StompWebSocketService) {}

  get connected$(): Observable<boolean> {
    return this.stomp.connected$;
  }

  get products$(): Observable<ProductMessage> {
    return this.stomp.products$;
  }

  get errors$(): Observable<ErrorMessage> {
    return this.stomp.errors$;
  }

  get status$(): Observable<StatusMessage> {
    return this.stomp.status$;
  }

  connect(): void {
    this.stomp.connect();
  }

  disconnect(): void {
    this.stomp.disconnect();
  }

  sendSearch(query: string, searchId?: string): void {
    this.stomp.sendSearchCommand(query, searchId);
  }
}

