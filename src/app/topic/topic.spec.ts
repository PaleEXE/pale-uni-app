import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Topic } from './topic';

describe('Topic', () => {
  let component: Topic;
  let fixture: ComponentFixture<Topic>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Topic],
    }).compileComponents();

    fixture = TestBed.createComponent(Topic);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
