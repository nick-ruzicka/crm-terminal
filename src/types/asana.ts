export interface AsanaTask {
  gid: string
  name: string
  notes: string
  due_on: string | null
  completed: boolean
  assignee: { gid: string; name: string } | null
  memberships: { section: { gid: string; name: string } }[]
}

export interface AsanaSection {
  gid: string
  name: string
}

export interface GroupedTasks {
  section: AsanaSection
  tasks: AsanaTask[]
}
