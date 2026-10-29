import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DashboardStats, StatsRange } from '../../models/stats.model';

@Injectable({
  providedIn: 'root',
})
export class StatsService {
  private http = inject(HttpClient);
  private apiUrl = 'api/stats';

  // Admin only: figures of the last <days> days, days counted in the browser's time zone
  getDashboard(days: StatsRange): Observable<DashboardStats> {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return this.http.get<DashboardStats>(this.apiUrl, {
      params: { days: String(days), tz },
    });
  }
}
