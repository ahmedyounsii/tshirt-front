import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DesignsDisplayerCategoriesComponent } from './designs-displayer-categories.component';

describe('DesignsDisplayerCategoriesComponent', () => {
  let component: DesignsDisplayerCategoriesComponent;
  let fixture: ComponentFixture<DesignsDisplayerCategoriesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DesignsDisplayerCategoriesComponent]
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
