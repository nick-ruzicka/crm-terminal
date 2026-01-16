export interface Deal {
  id: string
  name: string
  company: string | null
  stage: string | null
  deal_type: string | null
  source: string | null
  next_step: string | null
  next_step_due: string | null
  hubspot_id: string | null
  priority: string | null
  focus_area: string | null
  created_at: string
  updated_at: string | null
}

export interface Contact {
  id: string
  deal_id: string | null
  name: string | null
  email: string | null
  role: string | null
  telegram: string | null
  is_primary: boolean | null
}

export interface Note {
  id: string
  deal_id: string | null
  content: string | null
  meeting_date: string | null
  review_status: string | null
  is_potential_deal: boolean | null
  confidence: number | null
  suggested_company: string | null
  suggested_contact: string | null
  suggested_deal_type: string | null
  classification_reason: string | null
}

export interface ChatSession {
  id: string
  title: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface Embedding {
  id: string
  source_type: 'deal' | 'note' | 'task' | 'chat_message'
  source_id: string
  content: string
  embedding: string // vector stored as string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      deals: {
        Row: Deal
        Insert: Omit<Deal, 'id'> & { id?: string }
        Update: Partial<Deal>
      }
      contacts: {
        Row: Contact
        Insert: Omit<Contact, 'id'> & { id?: string }
        Update: Partial<Contact>
      }
      notes: {
        Row: Note
        Insert: Omit<Note, 'id'> & { id?: string }
        Update: Partial<Note>
      }
      chat_sessions: {
        Row: ChatSession
        Insert: Omit<ChatSession, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: Partial<ChatSession>
      }
      chat_messages: {
        Row: ChatMessage
        Insert: Omit<ChatMessage, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<ChatMessage>
      }
      embeddings: {
        Row: Embedding
        Insert: Omit<Embedding, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Embedding>
      }
    }
    Functions: {
      match_embeddings: {
        Args: {
          query_embedding: string
          match_threshold?: number
          match_count?: number
          filter_types?: string[] | null
        }
        Returns: {
          id: string
          source_type: string
          source_id: string
          content: string
          metadata: Record<string, unknown>
          similarity: number
        }[]
      }
    }
  }
}
