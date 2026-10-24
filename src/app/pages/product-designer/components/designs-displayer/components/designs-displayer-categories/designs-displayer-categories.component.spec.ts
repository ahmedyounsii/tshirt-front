import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { DesignsDisplayerCategoriesComponent } from './designs-displayer-categories.component';

describe('DesignsDisplayerCategoriesComponent', () => {
  let component: DesignsDisplayerCategoriesComponent;
  let fixture: ComponentFixture<DesignsDisplayerCategoriesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DesignsDisplayerCategoriesComponent],
      // What the app provides (app.config.ts), with no real HTTP requests
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService(),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(DesignsDisplayerCategoriesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
