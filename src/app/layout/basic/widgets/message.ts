import { DatePipe, NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppWebSocketService } from '@shared/services/app-websocket.service';
import { EventNotificationsService } from '@shared/services/event-notifications.service';
import { EventNotification } from '@shared/types/datasync';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { EMPTY, catchError, switchMap, timer } from 'rxjs';

type HeaderMessageLevel = 'info' | 'warning' | 'error';

export interface HeaderMessageItem {
  id: string;
  title: string;
  content: string;
  time: string | number;
  read: boolean;
  level: HeaderMessageLevel;
}

@Component({
  selector: 'header-message',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgClass,
    DatePipe,
    NzBadgeModule,
    NzButtonModule,
    NzDropdownModule,
    NzEmptyModule,
    NzIconModule,
  ],
  template: `
    <div
      class="header-message"
      nz-dropdown
      nzTrigger="click"
      nzPlacement="bottomRight"
      [nzDropdownMenu]="menu"
    >
      <nz-badge [nzCount]="unreadCount()" [nzOverflowCount]="99" nzSize="small">
        <button type="button" class="header-message__trigger" aria-label="消息通知">
          <nz-icon nzType="bell" class="header-message__bell" />
        </button>
      </nz-badge>
    </div>

    <nz-dropdown-menu #menu="nzDropdownMenu">
      <div class="header-message-panel">
        <div class="header-message-panel__header">
          <div>
            <div class="header-message-panel__title">{{ title }}</div>
            <div class="header-message-panel__subtitle">
              @if (unreadCount() > 0) {
                {{ unreadCount() }} 条未读消息
              } @else {
                暂无未读消息
              }
            </div>
          </div>

          <button
            nz-button
            nzType="link"
            class="header-message-panel__action"
            [disabled]="unreadCount() === 0"
            (click)="markAllRead()"
          >
            全部已读
          </button>
        </div>

        @if (messages().length) {
          <div class="header-message-panel__list">
            @for (item of messages(); track item.id) {
              <button
                type="button"
                class="header-message-item"
                [ngClass]="{
                  'is-read': item.read,
                  'is-warning': item.level === 'warning',
                  'is-error': item.level === 'error',
                }"
                (click)="handleItemClick(item)"
              >
                <span class="header-message-item__dot"></span>
                <div class="header-message-item__body">
                  <div class="header-message-item__row">
                    <span class="header-message-item__title">{{ item.title }}</span>
                    <span class="header-message-item__time">
                      {{ item.time | date: 'MM-dd HH:mm' }}
                    </span>
                  </div>
                  <div class="header-message-item__content">{{ item.content }}</div>
                </div>
              </button>
            }
          </div>
        } @else {
          <div class="header-message-panel__empty">
            <nz-empty nzNotFoundImage="simple" [nzNotFoundContent]="emptyText" />
          </div>
        }
      </div>
    </nz-dropdown-menu>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
    }

    .header-message {
      display: inline-flex;
      align-items: center;
    }

    .header-message__trigger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
    }

    .header-message__bell {
      font-size: 18px;
    }

    .header-message-panel {
      width: 360px;
      overflow: hidden;
      background: rgb(255 255 255 / 96%);
      border: 1px solid rgb(var(--nm-primary-rgb) / 8%);
      border-radius: 22px;
      box-shadow: 0 22px 44px rgb(var(--nm-primary-rgb) / 14%);
      backdrop-filter: blur(16px);
    }

    .header-message-panel__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 18px 14px;
      border-bottom: 1px solid rgb(var(--nm-primary-rgb) / 7%);
      background: linear-gradient(180deg, #fbfdfc 0%, #f5faf7 100%);
    }

    .header-message-panel__title {
      color: #203049;
      font-size: 16px;
      font-weight: 800;
      line-height: 1.3;
    }

    .header-message-panel__subtitle {
      margin-top: 4px;
      color: #81908a;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.4;
    }

    .header-message-panel__action.ant-btn-link {
      height: auto;
      padding: 2px 0;
      color: var(--nm-primary);
      font-weight: 700;
    }

    .header-message-panel__list {
      max-height: 388px;
      padding: 8px;
      overflow: auto;
    }

    .header-message-panel__list::-webkit-scrollbar {
      width: 6px;
    }

    .header-message-panel__list::-webkit-scrollbar-thumb {
      background: rgb(var(--nm-primary-rgb) / 14%);
      border-radius: 999px;
    }

    .header-message-item {
      display: flex;
      gap: 12px;
      width: 100%;
      padding: 12px;
      text-align: left;
      border: 0;
      border-radius: 16px;
      background: transparent;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .header-message-item:hover {
      background: rgb(var(--nm-primary-rgb) / 4%);
    }

    .header-message-item.is-read {
      opacity: 0.72;
    }

    .header-message-item__dot {
      width: 10px;
      height: 10px;
      margin-top: 6px;
      border-radius: 50%;
      flex: 0 0 auto;
      background: var(--nm-primary);
      box-shadow: 0 0 0 4px rgb(var(--nm-primary-rgb) / 8%);
    }

    .header-message-item.is-warning .header-message-item__dot {
      background: #b7791f;
      box-shadow: 0 0 0 4px rgb(183 121 31 / 9%);
    }

    .header-message-item.is-error .header-message-item__dot {
      background: #d14343;
      box-shadow: 0 0 0 4px rgb(209 67 67 / 9%);
    }

    .header-message-item__body {
      min-width: 0;
      flex: 1 1 auto;
    }

    .header-message-item__row {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
    }

    .header-message-item__title {
      color: #233348;
      font-size: 14px;
      font-weight: 700;
      line-height: 1.4;
    }

    .header-message-item__time {
      color: #99a5b2;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }

    .header-message-item__content {
      margin-top: 6px;
      color: #748191;
      font-size: 13px;
      font-weight: 500;
      line-height: 1.5;
    }

    .header-message-panel__empty {
      padding: 18px 12px 8px;
    }

    @media (max-width: 767px) {
      .header-message-panel {
        width: min(360px, calc(100vw - 24px));
      }

      .header-message-panel__header {
        padding: 16px 16px 12px;
      }

      .header-message-panel__list {
        max-height: 320px;
        padding: 6px;
      }
    }
  `,
})
export class HeaderMessage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly service = inject(EventNotificationsService);
  private readonly ws = inject(AppWebSocketService);
  private readonly notification = inject(NzNotificationService);

  @Input() title = '消息通知';
  @Input() emptyText = '暂无消息';
  @Input() set items(value: HeaderMessageItem[] | null | undefined) {
    if (value) {
      this.messages.set(value);
    }
  }

  @Output() readonly itemClick = new EventEmitter<HeaderMessageItem>();

  protected readonly messages = signal<HeaderMessageItem[]>([]);

  protected readonly unreadCount = computed(
    () => this.messages().filter((item) => !item.read).length,
  );

  ngOnInit(): void {
    timer(0, 30000)
      .pipe(
        switchMap(() => this.service.list({ page: 1, size: 20 }).pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => {
        this.messages.set((res.data ?? []).map((item) => this.toHeaderMessage(item)));
      });

    this.ws
      .on<EventNotification>('notification.created')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((item) => this.applyNotification(item));
  }

  protected markRead(id: string): void {
    this.messages.update((list) =>
      list.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
    this.service
      .markRead(id)
      .pipe(catchError(() => EMPTY))
      .subscribe();
  }

  protected markAllRead(): void {
    this.messages.update((list) => list.map((item) => ({ ...item, read: true })));
    this.service
      .markAllRead()
      .pipe(catchError(() => EMPTY))
      .subscribe();
  }

  protected handleItemClick(item: HeaderMessageItem): void {
    if (!item.read) {
      this.markRead(item.id);
    }
    this.itemClick.emit(item);
  }

  private toHeaderMessage(item: EventNotification): HeaderMessageItem {
    return {
      id: item.guid,
      title: item.title,
      content: item.content,
      time: item.eventTime || item.createTime,
      read: item.read === 1,
      level: this.normalizeLevel(item.level),
    };
  }

  private normalizeLevel(level: string): HeaderMessageLevel {
    if (level === 'warning' || level === 'error') {
      return level;
    }
    return 'info';
  }

  private applyNotification(item: EventNotification): void {
    if (!item?.guid) return;
    const message = this.toHeaderMessage(item);
    this.messages.update((list) =>
      [message, ...list.filter((current) => current.id !== message.id)].slice(0, 20),
    );
    this.popup(item);
  }

  private popup(item: EventNotification): void {
    const title = item.title || '系统通知';
    const content = item.content || '';
    switch (this.normalizeLevel(item.level)) {
      case 'error':
        this.notification.error(title, content);
        break;
      case 'warning':
        this.notification.warning(title, content);
        break;
      default:
        this.notification.info(title, content);
        break;
    }
  }
}
