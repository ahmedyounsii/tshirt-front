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

  // Admin: renames a design and/or changes its tags and categories (at least one); fields left out are kept
  updateDesign(
    id: string,
    changes: Partial<Pick<DesignModel, 'label' | 'tags' | 'categoryIds'>>,
  ): Observable<{ design: DesignModel; categoryIds: string[] }> {
    return this.http.patch<{ design: DesignModel; categoryIds: string[] }>(`api/designs/${id}`, changes);
  }

  deleteDesign(id: string): Observable<any> {
    return this.http.delete(`api/designs/${id}`);
  }
}
