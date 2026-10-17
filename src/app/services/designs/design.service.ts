import {
  HttpClient,
  HttpEvent,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DesignModel } from '../../models/design.model';

@Injectable({
  providedIn: 'root',
})
export class DesignsService {
  private apiUrl = 'api/designs';

  constructor(private http: HttpClient) {}

  getDesigns(ids?: string[]): Observable<DesignModel[]> {
    const params: Record<string, string> = ids ? { ids: ids.join(',') } : {};
    return this.http.get<DesignModel[]>('api/designs', { params });
  }

  addDesign(formData: FormData): Observable<any> {
    return this.http.post('api/designs', formData);
  }

  deleteDesign(id: string): Observable<any> {
    return this.http.delete(`api/designs/${id}`);
  }
}
