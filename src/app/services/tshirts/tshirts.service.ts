import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TshirtModel, TshirtPayload } from '../../models/tshirt.model';

export type TshirtsPageQuery = {
  page: number;
  size: number;
  category?: string;
  search?: string;
  // Only the logged in user's tshirts
  mine?: boolean;
};

export type TshirtsPage = {
  items: TshirtModel[];
  // Matching the search and category
  count: number;
  page: number;
  size: number;
  // Per category id (plus "other" and "all"), matching the search only
  counts: Record<string, number>;
};

@Injectable({
  providedIn: 'root',
})
export class TshirtsService {
  private apiUrl = 'api/tshirts';

  constructor(private http: HttpClient) {}

  getTshirts(category?: string): Observable<TshirtModel[]> {
    const params: Record<string, string> = category ? { category } : {};
    return this.http.get<TshirtModel[]>(this.apiUrl, { params });
  }

  // One page of tshirts, newest first, filtered on the server.
  // category: a category id, or "other" for tshirts without a known one
  getTshirtsPage(query: TshirtsPageQuery): Observable<TshirtsPage> {
    const params: Record<string, string> = {
      page: String(query.page),
      size: String(query.size),
    };
    if (query.category) params['category'] = query.category;
    if (query.search?.trim()) params['search'] = query.search.trim();
    const url = query.mine ? `${this.apiUrl}/mine` : this.apiUrl;
    return this.http.get<TshirtsPage>(url, { params });
  }

  // backFile: capture of the back, only when the back has designs
  addTshirt(
    file: File,
    tshirt: TshirtPayload,
    backFile?: File
  ): Observable<TshirtModel> {
    return this.http.post<TshirtModel>(
      this.apiUrl,
      this.toFormData(tshirt, file, backFile)
    );
  }

  // Replaces the tshirt's captures and editor state (owner or admin only)
  updateTshirt(
    id: string,
    file: File,
    tshirt: TshirtPayload,
    backFile?: File
  ): Observable<TshirtModel> {
    return this.http.put<TshirtModel>(
      `${this.apiUrl}/${id}`,
      this.toFormData(tshirt, file, backFile)
    );
  }

  deleteTshirt(id: string): Observable<{ message: string; tshirt: TshirtModel }> {
    return this.http.delete<{ message: string; tshirt: TshirtModel }>(
      `${this.apiUrl}/${id}`
    );
  }

  private toFormData(
    tshirt: TshirtPayload,
    file: File,
    backFile?: File
  ): FormData {
    const formData = new FormData();
    formData.append('file', file);
    if (backFile) {
      formData.append('backFile', backFile);
    }
    formData.append('label', tshirt.label);
    if (tshirt.color) {
      formData.append('color', tshirt.color);
    }
    if (tshirt.category) {
      formData.append('category', tshirt.category);
    }
    formData.append('designs', JSON.stringify(tshirt.designs ?? []));
    if (tshirt.templateId) {
      formData.append('templateId', tshirt.templateId);
    }
    if (tshirt.template) {
      formData.append('template', JSON.stringify(tshirt.template));
    }
    if (tshirt.canvas) {
      formData.append('canvas', JSON.stringify(tshirt.canvas));
    }
    if (tshirt.printAreas) {
      formData.append('printAreas', JSON.stringify(tshirt.printAreas));
    }
    formData.append('objects', JSON.stringify(tshirt.objects ?? []));
    return formData;
  }
}
