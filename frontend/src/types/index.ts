export interface Client {
  id: string;
  name: string;
}

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

export interface List {
  id: string;
  title: string;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  client_id: string;
  client_name: string;
  priority: string;
  status: string;
  due_date: string;
  due_time?: string;
  notes: string;
  estimated_time?: string;
  parent_id?: string | null;
  task_type?: string;
  list_id?: string;
  flagged?: boolean;
  subtasks?: Subtask[];
  recurring?: boolean;
  recurring_frequency?: string;
  reminder_at?: string;
  completed_at?: string | null;
  created_at?: string;
  gcal_event_id?: string;
}
