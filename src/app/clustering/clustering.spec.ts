import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Clustering } from './clustering';

describe('Plot', () => {
  let component: Clustering;
  let fixture: ComponentFixture<Clustering>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Clustering],
    }).compileComponents();

    fixture = TestBed.createComponent(Clustering);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
