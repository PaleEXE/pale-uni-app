import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

type Point = [number, number];

interface GraphNode {
  id: number;
  label: string;
  pos: Point;
  neighbors: number[];
}

interface GraphResponse {
  nodes: GraphNode[];
  node_count: number;
  edge_count: number;
}

interface GraphHealthResponse {
  status: string;
  model_loaded: boolean;
  model_path: string;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class GraphService {
  private readonly apiUrl = 'http://localhost:8000';

  constructor(private http: HttpClient) {}

  extractGraph(file: File): Observable<GraphResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<GraphResponse>(
      `${this.apiUrl}/graph/extract`,
      formData
    );
  }

  checkHealth(): Observable<GraphHealthResponse> {
    return this.http.get<GraphHealthResponse>(`${this.apiUrl}/graph/health`);
  }
}
