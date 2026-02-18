
export type ShapeType = 'start' | 'process' | 'decision' | 'input' | 'output' | 'end';

export interface FlowchartStep {
  id: number;
  type: ShapeType;
  text: string;
}

export interface DryRunStep {
  step_number: number;
  description: string;
  variable_state: Record<string, any>;
  flowchart_step_id: number;
  explanation?: string;
}

export interface ParseResult {
  variables: string[];
  digital_flowchart: FlowchartStep[];
}

export interface SimulationResult {
  dry_run: DryRunStep[];
  is_correct: boolean;
  accuracy_score: number;
  mistake_explanation?: string;
  expected_output: any;
  actual_output: any;
}

export interface AppState {
  description: string;
  image: string | null;
  inputs: Record<string, string>;
  isAnalyzing: boolean;
  isSimulating: boolean;
  parsedData: ParseResult | null;
  simulationData: SimulationResult | null;
  currentStepIndex: number;
  showResults: boolean;
  errorMessage: string | null;
  mode: 'text' | 'image';
}
