import { Injectable, NgZone, inject } from '@angular/core';
import { environment } from '@env/environment';
import { WebSocketEventType, WebSocketMessage } from '@shared/types/datasync';
import { Observable, Subject, filter, map, share } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AppWebSocketService {
  private readonly zone = inject(NgZone);
  private readonly messages$ = new Subject<WebSocketMessage>();
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private manualClose = false;

  readonly stream$ = this.messages$.asObservable().pipe(share());

  connect(): void {
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) return;
    this.manualClose = false;
    this.open();
  }

  disconnect(): void {
    this.manualClose = true;
    this.clearReconnectTimer();
    this.socket?.close();
    this.socket = null;
  }

  on<T>(type: WebSocketEventType | string): Observable<T> {
    this.connect();
    return this.stream$.pipe(
      filter((message) => message.type === type),
      map((message) => message.data as T),
    );
  }

  private open(): void {
    this.clearReconnectTimer();
    const socket = new WebSocket(this.socketUrl());
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
    };

    socket.onmessage = (event) => {
      this.zone.run(() => {
        const message = this.parseMessage(event.data);
        if (message) {
          this.messages$.next(message);
        }
      });
    };

    socket.onerror = () => {
      socket.close();
    };

    socket.onclose = () => {
      if (this.socket === socket) {
        this.socket = null;
      }
      if (!this.manualClose) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const delay = Math.min(30000, 1000 * 2 ** Math.min(this.reconnectAttempts, 5));
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private parseMessage(raw: unknown): WebSocketMessage | null {
    if (typeof raw !== 'string') return null;
    try {
      const message = JSON.parse(raw) as WebSocketMessage;
      return message?.type ? message : null;
    } catch {
      return null;
    }
  }

  private socketUrl(): string {
    const baseUrl = environment.api?.baseUrl || '';
    const path = this.joinPath(baseUrl, 'ws');
    if (/^https?:\/\//i.test(path)) {
      return path.replace(/^http/i, 'ws');
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private joinPath(base: string, path: string): string {
    if (!base) return `/${path}`;
    return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }
}
