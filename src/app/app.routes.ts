import { Routes } from '@angular/router';
import { HomePage } from './home-page/home-page';
import { LogicEvaluator } from './logic-evaluator/logic-evaluator';
import { Topic } from './topic/topic';

export const routes: Routes = [
    { path: '', component: HomePage },
    { path: 'home', component: HomePage },
    {
        path: 'topic/:topicId',
        component: Topic,
        data: { prerender: false },
    },
    {
        path: 'topic/:topicId/logic-evaluator',
        component: LogicEvaluator,
    },
];
