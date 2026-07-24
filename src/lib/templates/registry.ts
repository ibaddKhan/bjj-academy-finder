import { SSEEvent } from "@/lib/events";

export interface TemplateInputField {
  key: string;
  label: string;
  required: boolean;
}

export interface TemplateOutputField {
  key: string;
  label: string;
}

export interface TemplateSettings {
  openrouterKey: string;
  enrichmentModel1: string;
  enrichmentModel2: string;
  serperKey: string;
  facebookKey: string;
  zenrowsKey: string;
  scrapingantKey: string;
}

export interface TemplateInput {
  [key: string]: string;
}

export interface TemplateResult {
  success: boolean;
  status: string;
  data: Record<string, string | null>;
  sourceData?: Record<string, string | null>;
  error?: string;
}

export interface SSECallbacks {
  emit: (event: Omit<SSEEvent, "timestamp">) => void;
}

export interface PipelineTemplate {
  slug: string;
  name: string;
  description: string;
  inputFields: TemplateInputField[];
  outputFields: TemplateOutputField[];
  sourceOutputFields: TemplateOutputField[];
  run: (
    input: TemplateInput,
    settings: TemplateSettings,
    callbacks: SSECallbacks,
    context: { jobId: string; rowId: string; rowIndex: number }
  ) => Promise<TemplateResult>;
}

const templates: Record<string, PipelineTemplate> = {};

export function registerTemplate(t: PipelineTemplate) {
  templates[t.slug] = t;
}

export function getTemplate(slug: string): PipelineTemplate | null {
  return templates[slug] ?? null;
}

export function listTemplates(): PipelineTemplate[] {
  return Object.values(templates);
}

