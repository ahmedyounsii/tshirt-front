import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class uploadedDesignsService {
  uploadedDesigns = signal<any[]>([]); // adjust type if needed
}
