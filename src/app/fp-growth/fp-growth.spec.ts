import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FPGrowth } from './fp-growth';

describe('FPGrowth', () => {
  let component: FPGrowth;
  let fixture: ComponentFixture<FPGrowth>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FPGrowth],
    }).compileComponents();

    fixture = TestBed.createComponent(FPGrowth);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
