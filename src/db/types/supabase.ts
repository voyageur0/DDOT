/**
 * Types TypeScript générés automatiquement par Supabase
 * Commande: supabase gen types typescript
 * 
 * Note: Ce fichier est généré automatiquement, ne pas modifier manuellement
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      communes: {
        Row: {
          id: string
          name: string
          bfs_code: number | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          bfs_code?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          bfs_code?: number | null
          created_at?: string
        }
      }
      zones: {
        Row: {
          id: string
          commune_id: string
          code_norm: string
          label: string | null
          geom: unknown | null
          created_at: string
        }
        Insert: {
          id?: string
          commune_id: string
          code_norm: string
          label?: string | null
          geom?: unknown | null
          created_at?: string
        }
        Update: {
          id?: string
          commune_id?: string
          code_norm?: string
          label?: string | null
          geom?: unknown | null
          created_at?: string
        }
      }
      regulation_sources: {
        Row: {
          id: string
          pdf_path: string
          pdf_page: number | null
          article_ref: string | null
          ocr_confidence: number | null
          created_at: string
        }
        Insert: {
          id?: string
          pdf_path: string
          pdf_page?: number | null
          article_ref?: string | null
          ocr_confidence?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          pdf_path?: string
          pdf_page?: number | null
          article_ref?: string | null
          ocr_confidence?: number | null
          created_at?: string
        }
      }
      regulations: {
        Row: {
          id: string
          zone_id: string
          version: string
          indice_u: number | null
          ibus: number | null
          emprise_max: number | null
          h_max_m: number | null
          niveaux_max: number | null
          toit_types: Json | null
          pente_toit_min_max: Json | null
          recul_min_m: number | null
          remarques: string | null
          source_id: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          zone_id: string
          version?: string
          indice_u?: number | null
          ibus?: number | null
          emprise_max?: number | null
          h_max_m?: number | null
          niveaux_max?: number | null
          toit_types?: Json | null
          pente_toit_min_max?: Json | null
          recul_min_m?: number | null
          remarques?: string | null
          source_id?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          zone_id?: string
          version?: string
          indice_u?: number | null
          ibus?: number | null
          emprise_max?: number | null
          h_max_m?: number | null
          niveaux_max?: number | null
          toit_types?: Json | null
          pente_toit_min_max?: Json | null
          recul_min_m?: number | null
          remarques?: string | null
          source_id?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      regulations_normalized: {
        Row: {
          id: number
          commune_id: string
          zone_code_source: string
          zone_code_norm: string
          indice_u: number | null
          ibus: number | null
          emprise_max: number | null
          h_max_m: number | null
          niveaux_max: number | null
          toit_types: Json | null
          pente_toit_min_max: Json | null
          recul_min_m: number | null
          remarques: string | null
          source_pdf_path: string
          source_page: number | null
          inserted_at: string
          migrated: boolean
        }
        Insert: {
          id?: number
          commune_id: string
          zone_code_source: string
          zone_code_norm: string
          indice_u?: number | null
          ibus?: number | null
          emprise_max?: number | null
          h_max_m?: number | null
          niveaux_max?: number | null
          toit_types?: Json | null
          pente_toit_min_max?: Json | null
          recul_min_m?: number | null
          remarques?: string | null
          source_pdf_path: string
          source_page?: number | null
          inserted_at?: string
          migrated?: boolean
        }
        Update: {
          id?: number
          commune_id?: string
          zone_code_source?: string
          zone_code_norm?: string
          indice_u?: number | null
          ibus?: number | null
          emprise_max?: number | null
          h_max_m?: number | null
          niveaux_max?: number | null
          toit_types?: Json | null
          pente_toit_min_max?: Json | null
          recul_min_m?: number | null
          remarques?: string | null
          source_pdf_path?: string
          source_page?: number | null
          inserted_at?: string
          migrated?: boolean
        }
      }
    }
    Views: {
      v_regulations_latest: {
        Row: {
          id: string
          zone_id: string
          version: string
          indice_u: number | null
          ibus: number | null
          emprise_max: number | null
          h_max_m: number | null
          niveaux_max: number | null
          toit_types: Json | null
          pente_toit_min_max: Json | null
          recul_min_m: number | null
          remarques: string | null
          source_id: string | null
          is_active: boolean
          created_at: string
          commune_id: string
          code_norm: string
          zone_label: string | null
          geom: unknown | null
          commune_name: string
          bfs_code: number | null
        }
      }
    }
    Functions: {
      deactivate_old_regulations: {
        Args: {
          p_zone_id: string
          p_version: string
        }
        Returns: void
      }
      get_regulation_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_communes: number
          total_zones: number
          total_regulations: number
          active_regulations: number
          zones_with_geom: number
        }[]
      }
      refresh_materialized_view: {
        Args: {
          view_name: string
        }
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}