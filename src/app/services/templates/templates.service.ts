import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, Observable, of, shareReplay, tap } from 'rxjs';
import { TemplateModel, TemplatePayload } from '../../models/template.model';
import { environment } from '../../../environments/environment';

// The image to send with a save: a new file, "remove" (back only) to drop it, null to keep it
export type TemplateImageChange = File | 'remove' | null;

// Server path of a template image (/uploads/templates/...) to a url the browser can load
export const templateImageUrl = (path?: string | null): string =>
  path ? `${environment.baseUrl}${path}` : '';

@Injectable({
  providedIn: 'root',
})
export class TemplatesService {
  private http = inject(HttpClient);
  private apiUrl = 'api/templates';

  // Every template, grouped by style. Empty until loaded: readers fall back to the
  // copy saved with the product
  readonly templates = signal<TemplateModel[]>([]);
  readonly loaded = signal(false);
  private request$?: Observable<TemplateModel[]>;

  // Fetched once per visit (a few KB, no images): the admin's changes update the list
  load(): Observable<TemplateModel[]> {
    this.request$ ??= this.http.get<TemplateModel[]>(this.apiUrl).pipe(
      tap((list) => {
        this.templates.set(list);
        this.loaded.set(true);
      }),
      catchError(() => {
        // Retried on the next call
        this.request$ = undefined;
        this.loaded.set(true);
        return of(this.templates());
      }),
      shareReplay(1),
    );
    return this.request$;
  }

  byId(id?: string | null): TemplateModel | undefined {
    return id ? this.templates().find((t) => t.id === id) : undefined;
  }

  // Admin only
  create(payload: TemplatePayload, front: File, back: File | null): Observable<TemplateModel> {
    return this.http
      .post<TemplateModel>(this.apiUrl, this.toFormData(payload, front, back))
      .pipe(tap(() => this.refresh()));
  }

  // Admin only
  update(
    id: string,
    payload: TemplatePayload,
    front: File | null,
    back: TemplateImageChange,
  ): Observable<TemplateModel> {
    return this.http
      .put<TemplateModel>(`${this.apiUrl}/${id}`, this.toFormData(payload, front, back))
      .pipe(tap(() => this.refresh()));
  }

  // Admin only: saved products and orders keep their copy of it
  delete(id: string): Observable<{ message: string }> {
    return this.http
      .delete<{ message: string }>(`${this.apiUrl}/${id}`)
      .pipe(tap(() => this.templates.update((list) => list.filter((t) => t.id !== id))));
  }

  // The server sorts the list (also after the styles changed: names and order follow them)
  refresh() {
    this.request$ = undefined;
    this.load().subscribe();
  }

  private toFormData(
    payload: TemplatePayload,
    front: File | null,
    back: TemplateImageChange,
  ): FormData {
    const formData = new FormData();
    formData.append('style', payload.style);
    formData.append('colorLabel', payload.colorLabel);
    formData.append('color', payload.color);
    if (front) formData.append('front', front);
    if (back instanceof File) formData.append('back', back);
    else if (back === 'remove') formData.append('removeBack', 'true');
    return formData;
  }
}
