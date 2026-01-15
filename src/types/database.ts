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
    }
  }
}
