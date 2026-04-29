import { Injectable } from '@angular/core';
import { RxStomp } from '@stomp/rx-stomp';
import { Observable, Subject, BehaviorSubject, throwError } from 'rxjs';
import { IMessage } from '@stomp/stompjs';
import { HttpConfigService } from './http-config.service';
import SockJS from 'sockjs-client';

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
  private rxStomp: RxStomp;
  
  // Subjects para emitir mensajes a componentes
  private productsSubject = new Subject<ProductMessage>();
  private errorsSubject = new Subject<ErrorMessage>();
  private statusSubject = new Subject<StatusMessage>();
  private connectionSubject = new BehaviorSubject<boolean>(false);

  public products$ = this.productsSubject.asObservable();
  public errors$ = this.errorsSubject.asObservable();
  public status$ = this.statusSubject.asObservable();
  public connected$ = this.connectionSubject.asObservable();

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000; // 3 segundos

  constructor(private httpConfig: HttpConfigService) {
    this.rxStomp = new RxStomp();
    this.configureRxStomp();
  }

  /**
   * Configura RxStomp
   */
  private configureRxStomp(): void {
    // Convertir http://localhost:8080/api a http://localhost:8080/ws (URL para SockJS)
    const apiUrl = this.httpConfig.getApiBaseUrl();
    // Remover /api del final para obtener la URL base del servidor
    const baseUrl = apiUrl.replace(/\/api$/, '');
    // SockJS requiere URL HTTP/HTTPS, no WS/WSS
    const sockjsUrl = baseUrl + '/ws';

    this.rxStomp.configure({
      brokerURL: sockjsUrl,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      reconnectDelay: this.reconnectInterval,
      // Usar SockJS como transport
      webSocketFactory: () => new SockJS(sockjsUrl),
      debug: (msg: string) => {
        console.log('[STOMP]', msg);
      }
    });

    // Manejar conexión exitosa
    this.rxStomp.connected$.subscribe(() => {
      console.log('✓ Conectado a STOMP');
      this.reconnectAttempts = 0;
      this.connectionSubject.next(true);
      this.subscribeToQueues();
    });

    // Manejar desconexiones
    this.rxStomp.stompErrors$.subscribe((error: any) => {
      console.error('✗ STOMP Error:', error);
      this.connectionSubject.next(false);
    });
  }

  /**
   * Se suscribe a los queues de mensajes del backend
   */
  private subscribeToQueues(): void {
    // Queue de productos normalizados
    this.rxStomp.watch('/user/queue/products').subscribe((message: IMessage) => {
      try {
        const body = JSON.parse(message.body);
        console.log('📦 Mensaje de productos recibido:', body);
        this.productsSubject.next(body);
      } catch (error) {
        console.error('Error parsing product message:', error);
      }
    });

    // Queue de errores
    this.rxStomp.watch('/user/queue/errors').subscribe((message: IMessage) => {
      try {
        const body = JSON.parse(message.body);
        console.error('❌ Error del backend:', body);
        this.errorsSubject.next(body);
      } catch (error) {
        console.error('Error parsing error message:', error);
      }
    });

    // Queue de estado
    this.rxStomp.watch('/user/queue/status').subscribe((message: IMessage) => {
      try {
        const body = JSON.parse(message.body);
        console.log('⏳ Estado actualizado:', body);
        this.statusSubject.next(body);
      } catch (error) {
        console.error('Error parsing status message:', error);
      }
    });
  }

  /**
   * Conecta al servidor WebSocket
   */
  public connect(): void {
    if (this.rxStomp.connected()) {
      console.log('Ya está conectado');
      return;
    }

    console.log('🔌 Conectando a STOMP...');
    this.rxStomp.activate();
  }

  /**
   * Desconecta del servidor WebSocket
   */
  public disconnect(): void {
    if (this.rxStomp && this.rxStomp.connected()) {
      console.log('Desconectando de STOMP...');
      this.rxStomp.deactivate();
      this.connectionSubject.next(false);
    }
  }

  /**
   * Envía comando de búsqueda al backend
   * @param query Término de búsqueda
   * @param searchId ID único de búsqueda
   */
  public sendSearchCommand(query: string, searchId?: string): void {
    if (!this.isConnectedNow()) {
      console.error('No está conectado a STOMP');
      return;
    }

    const productRef = (searchId || query).trim().replace(/\s+/g, '');
    const payload = {
      search_id: productRef,
      query,
      product_ref: productRef,
      timestamp: new Date().toISOString()
    };

    console.log('📤 Enviando búsqueda:', payload);
    
    this.rxStomp.publish({
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
    if (!this.isConnectedNow()) {
      console.error('No está conectado a STOMP');
      return;
    }

    const payload = {
      product_ref: productRef,
      target_price: targetPrice,
      timestamp: new Date().toISOString()
    };

    console.log('🔔 Enviando alerta:', payload);
    
    this.rxStomp.publish({
      destination: '/app/alert',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Obtiene el estado de conexión actual (siempre false por ahora)
   */
  public isConnectedNow(): boolean {
    // STOMP deshabilitado temporalmente por incompatibilidad de handshake
    // Retornar false fuerza fallback a REST
    return false;
  }

  /**
   * Obtiene el nombre del usuario conectado (si está disponible)
   */
  public getConnectedUser(): string | null {
    // Esto se puede obtener del token JWT
    return localStorage.getItem('username') || null;
  }
}
