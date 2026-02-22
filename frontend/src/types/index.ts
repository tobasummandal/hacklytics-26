export interface World {
  id: string
  name: string
  description?: string
  created_at?: string
  rule_count: number
  character_count: number
}

export interface Rule {
  id: number
  world_id: string
  text: string
  system: SystemType
  chapter?: number
  page?: number
  confidence: number
}

export enum SystemType {
  MAGIC = 'magic',
  POLITICS = 'politics',
  TECHNOLOGY = 'technology',
  ECONOMY = 'economy',
  CULTURE = 'culture',
  OTHER = 'other'
}

export enum SeverityLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface InconsistencyReport {
  severity: SeverityLevel
  similarity: number
  rule_a: {
    text: string
    chapter?: number
    page?: number
    system: SystemType
  }
  rule_b: {
    text: string
    chapter?: number
    page?: number
    system: SystemType
  }
  explanation: string
}

export interface LoopholeReport {
  title: string
  systems_involved: SystemType[]
  description: string
  exploitable_rules: Array<{
    text: string
    system: SystemType
  }>
  creativity_score: number
}

export interface CharacterProfile {
  character_name: string
  traits: Array<{
    trait_type: string
    description: string
    confidence: number
  }>
  moral_alignment?: string
  primary_ability?: string
  motivation?: string
  consistency_score: number
  warning?: string
}

export interface GraphNode {
  id: string
  label: string
  type: string
  system?: SystemType
  color?: string
  size: number
}

export interface GraphEdge {
  from_node: string
  to_node: string
  weight: number
  label?: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}
