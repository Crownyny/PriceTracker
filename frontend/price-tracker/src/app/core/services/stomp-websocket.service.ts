import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { Client, IMessage } from '@stomp/stompjs';
import { HttpConfigService } from './http-config.service';

/**
 * Interfaz para mensajes de productos
 */
export interface ProductMessage {
  productRef: string;
  products: any[];
  status: string;
  totalResults: number;
  timestamp?: Date;
}

/**
 * Interfaz para mensajes de error
 */
export interface ErrorMessage {
  code: string;
  message: string;
  timestamp?: Date;
}

/**
 * Interfaz para mensajes de estado
 */
export interface StatusMessage {
  status: 'searching' | 'normalizing' | 'complete' | 'error';
  progress: number;
  message: string;
  timestamp?: Date;
}

/**
 * STOMP WebSocket Service - Gestiona conexión WebSocket con backend
 * 
 * Responsabilidades:
 * - Conectar/desconectar STOMP via RxStomp
 * - Escuchar queues de mensajes (/user/queue/products, /user/queue/errors, /user/queue/status)
 * - Publicar mensajes a topics (/app/search)
 * - Manejar reconexiones automáticas
 */
@Injectable({
  providedIn: 'root'
})
export class StompWebSocketService {
  private client: Client | null = null;
  private sockJsFactory: ((url: string) => any) | null = null;
  private readonly wsUrl: string;

  // Subjects para emitir mensajes a componentes
  private productsSubject = new Subject<ProductMessage>();
  private errorsSubject = new Subject<ErrorMessage>();
  private statusSubject = new Subject<StatusMessage>();
  private connectionSubject = new BehaviorSubject<boolean>(false);

  public products$ = this.productsSubject.asObservable();
  public errors$ = this.errorsSubject.asObservable();
  public status$ = this.statusSubject.asObservable();
  public connected$ = this.connectionSubject.asObservable();

  constructor(private httpConfig: HttpConfigService) {
    const apiUrl = this.httpConfig.getApiBaseUrl();
    const baseUrl = apiUrl.replace(/\/api$/, '');
    this.wsUrl = `${baseUrl}/ws`;
  }

  /**
   * Conecta al servidor WebSocket STOMP usando SockJS.
   */
  public connect(): void {
    if (this.client?.active) {
      return;
    }

    console.log('🔌 Conectando a STOMP WebSocket...');

    void this.ensureSockJsFactory().then((factory) => {
      this.client = new Client({
        webSocketFactory: () => factory(this.wsUrl),
        reconnectDelay: 3000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        debug: (msg: string) => console.log('[STOMP]', msg),
        onConnect: () => {
          console.log('✓ Conectado a STOMP');
          this.connectionSubject.next(true);
          this.subscribeToQueues();
        },
        onStompError: (frame) => {
          console.error('✗ STOMP Error:', frame.headers['message'], frame.body);
          this.connectionSubject.next(false);
        },
        onWebSocketClose: () => {
          console.log('ℹ️ WebSocket cerrado');
          this.connectionSubject.next(false);
        }
      });

      this.client.activate();
    }).catch((error) => {
      console.error('No se pudo inicializar SockJS/STOMP:', error);
      this.connectionSubject.next(false);
    });
  }

  /**
   * Desconecta del servidor WebSocket
   */
  public disconnect(): void {
    if (this.client) {
      void this.client.deactivate();
      this.client = null;
    }
    this.connectionSubject.next(false);
  }

  /**
   * Envía comando de búsqueda al backend
   * @param query Término de búsqueda
   * @param searchId ID único de búsqueda
   */
  public sendSearchCommand(query: string, searchId?: string): void {
    const productRef = (searchId || query).trim().replace(/\s+/g, '');

    if (!this.client?.connected) {
      console.warn('No hay conexión STOMP activa para enviar la búsqueda.');
      return;
    }

    // Nota: `prueba ac.html` funciona enviando `{ query }` a `/app/search`.
    // Mantenemos `product_ref/search_id` solo como metadata opcional (si backend lo ignora, no afecta).
    const payload = {
      query,
      product_ref: productRef,
      search_id: productRef
    };

    this.client.publish({
      destination: '/app/search',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Envía comando para crear alerta de precio
   * @param productRef Referencia del producto
   * @param targetPrice Precio objetivo
   */
  public sendPriceAlert(productRef: string, targetPrice: number): void {
    if (!this.client?.connected) {
      console.warn('No hay conexión STOMP activa para enviar la alerta.');
      return;
    }

    const payload = {
      product_ref: productRef,
      target_price: targetPrice,
      timestamp: new Date().toISOString()
    };

    this.client.publish({
      destination: '/app/alert',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Obtiene el estado de conexión actual (siempre false por ahora)
   */
  public isConnectedNow(): boolean {
    return Boolean(this.client?.connected);
  }

  /**
   * Obtiene el nombre del usuario conectado (si está disponible)
   */
  public getConnectedUser(): string | null {
    // Esto se puede obtener del token JWT
    return localStorage.getItem('username') || null;
  }

  private async ensureSockJsFactory(): Promise<(url: string) => any> {
    if (this.sockJsFactory) {
      return this.sockJsFactory;
    }

    const module = await import('sockjs-client');
    const SockJS = module.default;
    this.sockJsFactory = (url: string) => new SockJS(url);
    return this.sockJsFactory;
  }

  private subscribeToQueues(): void {
    if (!this.client?.connected) {
      return;
    }

    this.client.subscribe('/user/queue/products', (message: IMessage) => {
      try {
        this.productsSubject.next(JSON.parse(message.body));
      } catch (error) {
        console.error('Error parsing product message:', error);
      }
    });

    this.client.subscribe('/user/queue/errors', (message: IMessage) => {
      try {
        this.errorsSubject.next(JSON.parse(message.body));
      } catch (error) {
        console.error('Error parsing error message:', error);
      }
    });

    this.client.subscribe('/user/queue/status', (message: IMessage) => {
      try {
        this.statusSubject.next(JSON.parse(message.body));
      } catch (error) {
        console.error('Error parsing status message:', error);
      }
    });
  }
}
