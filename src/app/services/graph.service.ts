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

export interface SavedVisualRequest {
  saved_visual: Record<string, any>;
  type: string;
}

export interface SavedVisualResponse {
  id: number;
  saved_visual: Record<string, any>;
  type: string;
  updated_at: string;
  user_id: number;
}

export interface LabelCorrectionRequest {
  image_path: string;
  corrections: Record<number, string>;
  predicted_labels: Record<number, string>;
  data_structure_type?: string;
}

export interface LabelCorrectionResponse {
  image_path: string;
  data_structure_type: string;
  wrong_label: Record<string, any> | null;
  correct_label: Record<string, any>;
  created_at: string;
  user_id: number;
}

@Injectable({
  providedIn: 'root',
})
export class GraphService {
  private readonly apiUrl = 'http://localhost:8000';

  constructor(private http: HttpClient) {}

  extractGraph(file: File, userId: number): Observable<GraphResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<GraphResponse>(
      `${this.apiUrl}/graph/extract?user_id=${userId}`,
      formData
    );
  }

  checkHealth(): Observable<GraphHealthResponse> {
    return this.http.get<GraphHealthResponse>(`${this.apiUrl}/graph/health`);
  }

  saveVisual(
    userId: number,
    graphData: Record<string, any>,
    name: string
  ): Observable<SavedVisualResponse> {
    const request: SavedVisualRequest = {
      saved_visual: graphData,
      type: name,
    };

    return this.http.post<SavedVisualResponse>(
      `${this.apiUrl}/api/saved_visual?user_id=${userId}`,
      request
    );
  }

  getSavedVisuals(userId: number): Observable<SavedVisualResponse[]> {
    return this.http.get<SavedVisualResponse[]>(
      `${this.apiUrl}/api/saved_visuals/user/${userId}`
    );
  }

  deleteSavedVisual(visualId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/api/saved_visual/${visualId}`);
  }

  updateSavedVisual(
    visualId: number,
    graphData: Record<string, any>,
    name: string
  ): Observable<SavedVisualResponse> {
    const request: SavedVisualRequest = {
      saved_visual: graphData,
      type: name,
    };

    return this.http.put<SavedVisualResponse>(
      `${this.apiUrl}/api/saved_visual/${visualId}`,
      request
    );
  }

  saveLabelCorrections(
    userId: number,
    imagePath: string,
    corrections: Record<number, string>,
    predictedLabels: Record<number, string>
  ): Observable<LabelCorrectionResponse> {
    const request: LabelCorrectionRequest = {
      image_path: imagePath,
      corrections,
      predicted_labels: predictedLabels,
      data_structure_type: 'graph_nodes',
    };

    return this.http.post<LabelCorrectionResponse>(
      `${this.apiUrl}/api/label_correction?user_id=${userId}`,
      request
    );
  }

  getLabelCorrections(imagePath: string): Observable<LabelCorrectionResponse> {
    return this.http.get<LabelCorrectionResponse>(
      `${this.apiUrl}/api/label_correction/${encodeURIComponent(imagePath)}`
    );
  }

  deleteLabelCorrections(imagePath: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/api/label_correction/${encodeURIComponent(imagePath)}`
    );
  }
}
