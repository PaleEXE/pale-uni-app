import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LogicEvaluator } from './logic-evaluator';

describe('TruthTable', () => {
    let component: LogicEvaluator;
    let fixture: ComponentFixture<LogicEvaluator>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [LogicEvaluator],
        }).compileComponents();

        fixture = TestBed.createComponent(LogicEvaluator);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
