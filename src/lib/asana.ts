const ASANA_BASE_URL = 'https://app.asana.com/api/1.0'
const MY_ASANA_USER_GID = process.env.ASANA_USER_GID || '1208992636286349' // Nick's user ID

export interface AsanaTask {
  gid: string
  name: string
  notes: string
  due_on: string | null
  completed: boolean
  assignee: { gid: string; name: string } | null
  memberships: { section: { gid: string; name: string } }[]
  num_subtasks?: number
  subtasks?: AsanaTask[]
}

export interface AsanaSection {
  gid: string
  name: string
}

export interface GroupedTasks {
  section: AsanaSection
  tasks: AsanaTask[]
}

export async function asanaFetch<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  const token = process.env.ASANA_ACCESS_TOKEN
  if (!token) {
    console.error('ASANA_ACCESS_TOKEN not configured')
    return null
  }

  try {
    const res = await fetch(`${ASANA_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!res.ok) {
      console.error(`Asana API error: ${res.status} ${res.statusText}`)
      return null
    }

    const json = await res.json()
    return json.data as T
  } catch (error) {
    console.error('Asana fetch error:', error)
    return null
  }
}

export async function getProjectSections(): Promise<AsanaSection[]> {
  const projectId = process.env.ASANA_PROJECT_ID
  if (!projectId) return []

  const sections = await asanaFetch<AsanaSection[]>(`/projects/${projectId}/sections`)
  return sections || []
}

export async function getProjectTasks(): Promise<AsanaTask[]> {
  const projectId = process.env.ASANA_PROJECT_ID
  if (!projectId) return []

  const tasks = await asanaFetch<AsanaTask[]>(
    `/projects/${projectId}/tasks?opt_fields=name,notes,due_on,completed,assignee.name,assignee.gid,memberships.section.name,num_subtasks`
  )
  return tasks || []
}

/**
 * Get only tasks assigned to me (Nick)
 */
export async function getMyProjectTasks(): Promise<AsanaTask[]> {
  const tasks = await getProjectTasks()
  return tasks.filter(t => t.assignee?.gid === MY_ASANA_USER_GID)
}

export async function getTaskSubtasks(taskGid: string): Promise<AsanaTask[]> {
  const subtasks = await asanaFetch<AsanaTask[]>(
    `/tasks/${taskGid}/subtasks?opt_fields=name,completed,due_on,assignee.name`
  )
  return subtasks || []
}

export async function getTaskDetails(taskGid: string): Promise<AsanaTask | null> {
  const task = await asanaFetch<AsanaTask>(
    `/tasks/${taskGid}?opt_fields=name,notes,due_on,completed,assignee.name,memberships.section.name,num_subtasks`
  )
  return task
}

export async function completeTask(taskGid: string, completed: boolean): Promise<boolean> {
  const result = await asanaFetch<AsanaTask>(`/tasks/${taskGid}`, {
    method: 'PUT',
    body: JSON.stringify({ data: { completed } }),
  })
  return result !== null
}

export function isTaskDueToday(task: AsanaTask): boolean {
  if (!task.due_on) return false
  const dueDate = new Date(task.due_on)
  const today = new Date()
  return (
    dueDate.getFullYear() === today.getFullYear() &&
    dueDate.getMonth() === today.getMonth() &&
    dueDate.getDate() === today.getDate()
  )
}

export async function getTasksGroupedBySection(): Promise<GroupedTasks[]> {
  const [sections, tasks] = await Promise.all([
    getProjectSections(),
    getProjectTasks(),
  ])

  // Create a map of section gid to tasks
  const sectionTaskMap = new Map<string, AsanaTask[]>()

  // Initialize with empty arrays for each section
  sections.forEach(section => {
    sectionTaskMap.set(section.gid, [])
  })

  // Group tasks by their section
  tasks.forEach(task => {
    if (task.memberships && task.memberships.length > 0) {
      const sectionGid = task.memberships[0].section.gid
      const existing = sectionTaskMap.get(sectionGid) || []
      existing.push(task)
      sectionTaskMap.set(sectionGid, existing)
    }
  })

  // Build the result maintaining section order
  return sections.map(section => ({
    section,
    tasks: sectionTaskMap.get(section.gid) || [],
  }))
}

export function isTaskDueThisWeek(task: AsanaTask): boolean {
  if (!task.due_on) return false

  const dueDate = new Date(task.due_on)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const weekFromNow = new Date(today)
  weekFromNow.setDate(weekFromNow.getDate() + 7)

  return dueDate >= today && dueDate <= weekFromNow
}

export function isTaskOverdue(task: AsanaTask): boolean {
  if (!task.due_on || task.completed) return false

  const dueDate = new Date(task.due_on)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return dueDate < today
}

export async function getTasksDueSoon(): Promise<AsanaTask[]> {
  const tasks = await getProjectTasks()

  return tasks
    .filter(task => !task.completed && (isTaskDueThisWeek(task) || isTaskOverdue(task)))
    .sort((a, b) => {
      if (!a.due_on) return 1
      if (!b.due_on) return -1
      return new Date(a.due_on).getTime() - new Date(b.due_on).getTime()
    })
}

export async function getTasksDueToday(): Promise<AsanaTask[]> {
  const tasks = await getProjectTasks()

  return tasks
    .filter(task => !task.completed && isTaskDueToday(task))
    .sort((a, b) => a.name.localeCompare(b.name))
}
