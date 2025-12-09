import { Routes } from '@angular/router';
import { HomePage } from './home-page/home-page';
import { LogicEvaluator } from './logic-evaluator/logic-evaluator';
import { Topic } from './topic/topic';
import { Plot } from './plot/plot';
import { FPGrowth } from './fp-growth/fp-growth';
import { LinearRegression } from './linear-regression/linear-regression';
import { Graph } from './graph/graph';
import { LoginComponent } from './login/login';
import { RegisterComponent } from './register/register';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
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
  {
    path: 'topic/:topicId/graph',
    component: Graph,
  },
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
  {
    path: 'topic/:topicId/graph',
    component: Graph,
  },
];
