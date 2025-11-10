import { Routes } from '@angular/router';
import { HomePage } from './home-page/home-page';
import { LogicEvaluator } from './logic-evaluator/logic-evaluator';
import { Topic } from './topic/topic';
import { Plot } from './plot/plot';
import { FPGrowth } from './fp-growth/fp-growth';
import { LinearRegression } from './linear-regression/linear-regression';

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
  {
    path: 'topic/:topicId/plot',
    component: Plot,
  },
  {
    path: 'topic/:topicId/fp-growth',
    component: FPGrowth,
  },
  {
    path: 'topic/:topicId/linear-regression',
    component: LinearRegression,
  },
];
