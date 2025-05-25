import {
  HttpClient,
  HttpEvent,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class CategoriesService {
  private apiUrl = 'api/categories';

  constructor(private http: HttpClient) {}

  addCategory(label: string): Observable<any> {
    return this.http.post<any>(this.apiUrl, { label });
  }

  getCategoriesByLabel(label: string) {
    return this.http.get<any[]>(`${this.apiUrl}/search`, {
      params: { label },
    });
  }

  getAllCategories(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getAllCategoriesWithDesigns(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/designs`);
  }

  getAllDesigns(
    id: string,
    page: number = 1,
    size: number = 10,
    search: string = ''
  ) {
    const params: any = {
      page: page.toString(),
      size: size.toString(),
    };

    if (search.trim()) {
      params.search = search.trim();
    }

    return this.http.get(`${this.apiUrl}/${id}`, { params });
  }
}
