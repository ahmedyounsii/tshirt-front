import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, Observable, of, shareReplay, tap } from 'rxjs';
import { TemplateStyle, TemplateStylePayload } from '../../models/template-style.model';
import { LanguageService, LANGUAGES } from '../language.service';

// A product type and its styles, in the shop's order
export type TemplateStyleGroup = { type: string; styles: TemplateStyle[] };

// The styles the admins manage. Their names are added to the translations
// (templates.styles.<key|type>, designer.styleHints.<key>): labels keep using the translate pipe
@Injectable({
  providedIn: 'root',
})
export class TemplateStylesService {
  private http = inject(HttpClient);
  private language = inject(LanguageService);
  private apiUrl = 'api/template-styles';

  // In the shop's order. Empty until loaded: labels use the bundled translations meanwhile
  readonly styles = signal<TemplateStyle[]>([]);
  readonly loaded = signal(false);
  private request$?: Observable<TemplateStyle[]>;

  readonly keys = computed(() => this.styles().map((s) => s.key));

  readonly groups = computed(() => {
    const groups: TemplateStyleGroup[] = [];
    for (const style of this.styles()) {
      const group = groups.find((g) => g.type === style.type);
      if (group) group.styles.push(style);
      else groups.push({ type: style.type, styles: [style] });
    }
    return groups;
  });

  // Fetched once per visit: the admin's changes update the list
  load(): Observable<TemplateStyle[]> {
    this.request$ ??= this.http.get<TemplateStyle[]>(this.apiUrl).pipe(
      tap((list) => this.set(list)),
      catchError(() => {
        // Retried on the next call
        this.request$ = undefined;
        this.loaded.set(true);
        return of(this.styles());
      }),
      shareReplay(1),
    );
    return this.request$;
  }

  byKey(key?: string | null): TemplateStyle | undefined {
    return key ? this.styles().find((s) => s.key === key) : undefined;
  }

  // Admin only; each change answers the whole list
  create(payload: TemplateStylePayload): Observable<TemplateStyle[]> {
    return this.http.post<TemplateStyle[]>(this.apiUrl, payload).pipe(tap((l) => this.set(l)));
  }

  update(key: string, payload: TemplateStylePayload): Observable<TemplateStyle[]> {
    return this.http
      .put<TemplateStyle[]>(`${this.apiUrl}/${key}`, payload)
      .pipe(tap((l) => this.set(l)));
  }

  reorder(keys: string[]): Observable<TemplateStyle[]> {
    return this.http
      .put<TemplateStyle[]>(`${this.apiUrl}/order`, { keys })
      .pipe(tap((l) => this.set(l)));
  }

  // Refused (409) while templates use it
  delete(key: string): Observable<TemplateStyle[]> {
    return this.http
      .delete<TemplateStyle[]>(`${this.apiUrl}/${key}`)
      .pipe(tap((l) => this.set(l)));
  }

  private set(list: TemplateStyle[]) {
    this.styles.set(list);
    this.loaded.set(true);
    for (const lang of LANGUAGES) {
      const styles: Record<string, string> = {};
      const hints: Record<string, string> = {};
      for (const s of list) {
        styles[s.type] = s.typeNames[lang];
        // Empty overrides the bundled hint the admin removed
        hints[s.key] = s.hints[lang];
      }
      // A style named after its type ("sweatshirt") keeps its own name
      for (const s of list) styles[s.key] = s.names[lang];
      this.language.extend(lang, { templates: { styles }, designer: { styleHints: hints } });
    }
  }
}
