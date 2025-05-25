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
export class DesignsService {
  private apiUrl = 'api/designs';

  constructor(private http: HttpClient) {}

  addDesign(formData: FormData): Observable<any> {
    return this.http.post('/api/designs', formData);
  }
}
