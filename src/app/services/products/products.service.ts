import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ProductModel, ProductPayload, ProductType } from '../../models/product.model';

export type ProductsPageQuery = {
  page: number;
  size: number;
  type?: ProductType;
  category?: string;
  search?: string;
  // Only the logged in user's products
  mine?: boolean;
  // Only the logged in user's favorites
  favorites?: boolean;
  // Only the products of this collection (id)
  collection?: string;
  // Only the products saved by this user (id)
  creator?: string;
};

export type ProductsPage = {
  items: ProductModel[];
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
export class ProductsService {
  private apiUrl = 'api/products';

  constructor(private http: HttpClient) {}

  getProducts(category?: string): Observable<ProductModel[]> {
    const params: Record<string, string> = category ? { category } : {};
    return this.http.get<ProductModel[]>(this.apiUrl, { params });
  }

  // One page of products, newest first, filtered on the server.
  // type: only tshirts or sweatshirts (counts follow it too)
  // category: a category id, or "other" for products without a known one
  getProductsPage(query: ProductsPageQuery): Observable<ProductsPage> {
    const params: Record<string, string> = {
      page: String(query.page),
      size: String(query.size),
    };
    if (query.type) params['type'] = query.type;
    if (query.category) params['category'] = query.category;
    if (query.search?.trim()) params['search'] = query.search.trim();
    if (query.collection) params['collection'] = query.collection;
    if (query.creator) params['creator'] = query.creator;
    if (query.favorites) params['favorites'] = 'true';
    const url = query.mine ? `${this.apiUrl}/mine` : this.apiUrl;
    return this.http.get<ProductsPage>(url, { params });
  }

  // One product with its creator (the product page)
  getProduct(id: string): Observable<ProductModel> {
    return this.http.get<ProductModel>(`${this.apiUrl}/${id}`);
  }

  // backFile: capture of the back, only when the back has designs
  addProduct(
    file: File,
    product: ProductPayload,
    backFile?: File
  ): Observable<ProductModel> {
    return this.http.post<ProductModel>(
      this.apiUrl,
      this.toFormData(product, file, backFile)
    );
  }

  // Replaces the product's captures and editor state (owner or admin only)
  updateProduct(
    id: string,
    file: File,
    product: ProductPayload,
    backFile?: File
  ): Observable<ProductModel> {
    return this.http.put<ProductModel>(
      `${this.apiUrl}/${id}`,
      this.toFormData(product, file, backFile)
    );
  }

  // Renames the product and/or changes its category (null clears it), keeping its captures
  // and editor state (creator only)
  updateDetails(
    id: string,
    details: { label: string; category: string | null }
  ): Observable<ProductModel> {
    return this.http.patch<ProductModel>(`${this.apiUrl}/${id}`, details);
  }

  // Sets the price alone (null clears it), without touching the captures or editor state
  updatePrice(id: string, price: number | null): Observable<ProductModel> {
    return this.http.patch<ProductModel>(`${this.apiUrl}/${id}/price`, { price });
  }

  deleteProduct(id: string): Observable<{ message: string; product: ProductModel }> {
    return this.http.delete<{ message: string; product: ProductModel }>(
      `${this.apiUrl}/${id}`
    );
  }

  private toFormData(
    product: ProductPayload,
    file: File,
    backFile?: File
  ): FormData {
    const formData = new FormData();
    formData.append('file', file);
    if (backFile) {
      formData.append('backFile', backFile);
    }
    formData.append('label', product.label);
    if (product.type) {
      formData.append('type', product.type);
    }
    if (product.color) {
      formData.append('color', product.color);
    }
    // Sent even when empty, so an update can remove the category
    if (product.category !== undefined) {
      formData.append('category', product.category);
    }
    formData.append('designs', JSON.stringify(product.designs ?? []));
    // undefined keeps the current price on update, null clears it
    if (product.price !== undefined) {
      formData.append('price', product.price === null ? '' : String(product.price));
    }
    if (product.templateId) {
      formData.append('templateId', product.templateId);
    }
    if (product.template) {
      formData.append('template', JSON.stringify(product.template));
    }
    if (product.canvas) {
      formData.append('canvas', JSON.stringify(product.canvas));
    }
    if (product.printAreas) {
      formData.append('printAreas', JSON.stringify(product.printAreas));
    }
    formData.append('objects', JSON.stringify(product.objects ?? []));
    return formData;
  }
}
