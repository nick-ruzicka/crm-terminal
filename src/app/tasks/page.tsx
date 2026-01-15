import { getTasksGroupedBySection } from '@/lib/asana'
import { TasksView } from '@/components/TasksView'

export const revalidate = 0

export default async function TasksPage() {
  const groupedTasks = await getTasksGroupedBySection()

  if (groupedTasks.length === 0) {
    return (
      <div>
        <div className="view-header">
          <h1>Tasks</h1>
        </div>
        <div className="card">
          <div className="empty-state">
            No tasks found. Check your Asana configuration.
          </div>
        </div>
      </div>
    )
  }

  return <TasksView initialData={groupedTasks} />
}
