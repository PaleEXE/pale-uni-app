import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Plot } from './plot';

describe('Plot', () => {
  let component: Plot;
  let fixture: ComponentFixture<Plot>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Plot],
    }).compileComponents();

    fixture = TestBed.createComponent(Plot);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
