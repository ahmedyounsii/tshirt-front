import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ApplicationDetail,
  ApplicationsPage,
  AuditPage,
  browserTimeZone,
  CommissionSettings,
  IssuedCode,
  LedgerPage,
  LedgerQuery,
  Payout,
  Revenue,
  SellerApplication,
  SellersPage,
  SellerSummary,
} from '../../models/seller.model';
import { paramsOf } from '../seller/seller.service';

// Admin side of the marketplace: reviewing seller applications and their activation codes,
// commission rates, sellers, platform revenue, payouts and the audit log
@Injectable({
  providedIn: 'root',
})
export class MarketplaceService {
  private http = inject(HttpClient);
  private applicationsUrl = 'api/seller-applications';
  private apiUrl = 'api/marketplace';

  // ---- Applications

  getApplications(query: {
    page: number;
    size: number;
    status?: string;
    search?: string;
    from?: string;
  }): Observable<ApplicationsPage> {
    return this.http.get<ApplicationsPage>(this.applicationsUrl, { params: paramsOf(query) });
  }

  getApplication(id: string): Observable<ApplicationDetail> {
    return this.http.get<ApplicationDetail>(`${this.applicationsUrl}/${id}`);
  }

  approve(id: string): Observable<IssuedCode & { application: SellerApplication }> {
    return this.http.post<IssuedCode & { application: SellerApplication }>(
      `${this.applicationsUrl}/${id}/approve`,
      {},
    );
  }

  reject(id: string, reason: string): Observable<SellerApplication> {
    return this.http.post<SellerApplication>(`${this.applicationsUrl}/${id}/reject`, { reason });
  }

  // The live code again, to resend it
  revealCode(id: string): Observable<IssuedCode> {
    return this.http.get<IssuedCode>(`${this.applicationsUrl}/${id}/code`);
  }

  // A new code: the old one stops working
  regenerateCode(id: string): Observable<IssuedCode> {
    return this.http.post<IssuedCode>(`${this.applicationsUrl}/${id}/code`, {});
  }

  revokeCode(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.applicationsUrl}/${id}/code`);
  }

  // Deletes an application with its codes; seller access already granted stays
  deleteApplication(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.applicationsUrl}/${id}`);
  }

  // ---- Commission and sellers

  getSettings(): Observable<CommissionSettings> {
    return this.http.get<CommissionSettings>(`${this.apiUrl}/settings`);
  }

  saveDefaultRate(defaultRate: number): Observable<CommissionSettings> {
    return this.http.put<CommissionSettings>(`${this.apiUrl}/settings`, { defaultRate });
  }

  getSellers(query: { page: number; size: number; status?: string; search?: string }): Observable<SellersPage> {
    return this.http.get<SellersPage>(`${this.apiUrl}/sellers`, { params: paramsOf(query) });
  }

  getSeller(id: string): Observable<SellerSummary> {
    return this.http.get<SellerSummary>(`${this.apiUrl}/sellers/${id}`);
  }

  // null goes back to the default rate
  setSellerRate(id: string, rate: number | null): Observable<SellerSummary> {
    return this.http.put<SellerSummary>(`${this.apiUrl}/sellers/${id}/commission`, { rate });
  }

  setSellerStatus(id: string, status: 'active' | 'suspended', reason = ''): Observable<SellerSummary> {
    return this.http.patch<SellerSummary>(`${this.apiUrl}/sellers/${id}/status`, { status, reason });
  }

  // Wipes the seller's store and seller access, once their earnings are paid out; the ledger
  // and payouts are kept
  deleteStore(id: string, reason: string): Observable<{ _id: string }> {
    return this.http.delete<{ _id: string }>(`${this.apiUrl}/sellers/${id}`, { body: { reason } });
  }

  recordPayout(id: string, reference: string, note: string): Observable<Payout> {
    return this.http.post<Payout>(`${this.apiUrl}/sellers/${id}/payouts`, { reference, note });
  }

  // ---- Revenue

  getRevenue(query: LedgerQuery): Observable<Revenue> {
    return this.http.get<Revenue>(`${this.apiUrl}/revenue`, {
      params: paramsOf({ ...query, tz: browserTimeZone() }),
    });
  }

  getLedger(query: LedgerQuery): Observable<LedgerPage> {
    return this.http.get<LedgerPage>(`${this.apiUrl}/ledger`, { params: paramsOf({ ...query }) });
  }

  getAudit(query: { page: number; size: number; action?: string }): Observable<AuditPage> {
    return this.http.get<AuditPage>(`${this.apiUrl}/audit`, { params: paramsOf(query) });
  }

  deleteAuditEntry(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/audit/${id}`);
  }

  // Every entry goes; the server keeps one saying who cleared the log
  clearAudit(): Observable<{ message: string; count: number }> {
    return this.http.delete<{ message: string; count: number }>(`${this.apiUrl}/audit`);
  }
}
