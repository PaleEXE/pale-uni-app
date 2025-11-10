import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LinearRegression } from './linear-regression';

describe('LinearRegression', () => {
  let component: LinearRegression;
  let fixture: ComponentFixture<LinearRegression>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LinearRegression]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LinearRegression);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
