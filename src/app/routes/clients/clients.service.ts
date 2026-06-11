import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type RelayClientType = 'bridge' | 'app';

export interface RelayClient {
  guid: string;
  createTime: number;
  updateTime: number;
  accountGuid: string;
  accountName: string;
  clientId: string;
  clientSecret: string;
  clientType: RelayClientType | string;
  name: string;
  platform: string;
  version: string;
  status: number;
  lastIp: string;
  lastSeenAt: number;
  revokedAt: number;
  revokeReason: string;
}

export interface ClientPage {
  data: RelayClient[];
  total: number;
  page: number;
  size: number;
}

export interface CreateClientPayload {
  accountGuid?: string;
  accountName?: string;
  clientType: RelayClientType;
  name: string;
  platform?: string;
  version?: string;
}

export interface UpdateClientPayload {
  name: string;
  platform?: string;
  version?: string;
  status?: number;
}

export interface CreateClientResult {
  accountGuid: string;
  clientGuid: string;
  clientId: string;
  clientSecret: string;
}

export interface RotateSecretResult {
  clientSecret: string;
}

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly http = inject(HttpClient);

  list(page = 1, size = 10, content = '', enabled: string | number = ''): Observable<ClientPage> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (content) {
      params = params.set('content', content);
    }
    if (enabled !== '') {
      params = params.set('enabled', enabled);
    }
    return this.http.get<ClientPage>('/clients/list', {
      params,
    });
  }

  get(guid: string): Observable<RelayClient> {
    return this.http.get<RelayClient>(`/clients/${guid}`);
  }

  create(payload: CreateClientPayload): Observable<CreateClientResult> {
    return this.http.post<CreateClientResult>('/clients', payload);
  }

  update(guid: string, payload: UpdateClientPayload): Observable<boolean> {
    return this.http.put<boolean>(`/clients/${guid}`, payload);
  }

  revoke(guid: string, reason?: string): Observable<boolean> {
    return this.http.delete<boolean>(`/clients/${guid}`, {
      body: { reason: reason ?? '' },
    });
  }

  rotateSecret(guid: string): Observable<RotateSecretResult> {
    return this.http.post<RotateSecretResult>(`/clients/${guid}/rotate-secret`, {});
  }
}
