import { Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SignalRService {
  private hub!: signalR.HubConnection;

  // Signals for reactive UI updates
  lastDonation = signal<any>(null);
  lastMemberChange = signal<any>(null);
  lastCaseChange = signal<any>(null);
  lastCategoryChange = signal<any>(null);
  lastVolunteerChange = signal<any>(null);
  lastGuideChange = signal<any>(null);
  lastTransportationChange = signal<any>(null);
  liquidityChanged = signal<number>(0);

  constructor(private authService: AuthService) {}

  startConnection(): void {
    this.hub = new signalR.HubConnectionBuilder()
      .withUrl(environment.hubUrl, {
        accessTokenFactory: () => this.authService.getToken() || ''
      })
      .withAutomaticReconnect()
      .build();

    this.registerHandlers();

    this.hub.start()
      .then(() => console.log('✅ SignalR connected'))
      .catch(err => console.error('❌ SignalR error:', err));
  }

  private registerHandlers(): void {
    // Triggered when someone donates — updates card total live
    this.hub.on('DonationAdded', (data) => {
      this.lastDonation.set(data);
      this.lastCategoryChange.set({ id: data.categoryId, newTotal: data.newTotal });
    });

    // Triggered when a member is added/edited/deleted
    this.hub.on('MemberChanged', (data) => {
      this.lastMemberChange.set(data);
    });

    // Triggered when a case is added/edited/status changed/deleted
    this.hub.on('CaseChanged', (data) => {
      this.lastCaseChange.set(data);
    });

    this.hub.on('CasesCleared', () => {
      this.lastCaseChange.set({ action: 'cleared' });
    });

    this.hub.on('LiquidityChanged', () => {
      this.liquidityChanged.update(v => v + 1);
    });

    this.hub.on('VolunteerChanged', (data) => {
      this.lastVolunteerChange.set(data);
    });

    this.hub.on('GuideChanged', (data) => {
      this.lastGuideChange.set(data);
    });

    this.hub.on('TransportationChanged', (data) => {
      this.lastTransportationChange.set(data);
    });
  }

  stopConnection(): void {
    if (this.hub) this.hub.stop();
  }
}
