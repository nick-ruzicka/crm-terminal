import { getSupabase } from '@/lib/supabase'
import Link from 'next/link'
import type { Deal } from '@/types/database'
import { getTasksDueSoon, getTasksDueToday, isTaskOverdue } from '@/lib/asana'
import type { AsanaTask } from '@/lib/asana'
import {
  Greeting,
  QuickActions,
  PendingReviewsWidget,
  TasksDueTodayWidget,
  ActivityFeedWidget,
} from '@/components/DashboardWidgets'
import { formatStageName, formatRelativeTime } from '@/lib/dateUtils'

interface DashboardStats {
  total: number
  byStage: Record<string, number>
  recentDeals: Deal[]
  pendingReviews: number
  recentActivity: Array<{
    id: string
    type: 'deal_moved' | 'deal_created' | 'task_completed' | 'note_added'
    title: string
    subtitle: string
    timestamp: string
  }>
}

async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = getSupabase()

  const [dealsRes, reviewsRes, recentDealsRes] = await Promise.all([
    supabase.from('deals').select('*'),
    // Fetch ids and count manually (Supabase JS client has issues with count + multiple eq filters)
    supabase
      .from('notes')
      .select('id')
      .eq('review_status', 'pending')
      .eq('is_potential_deal', true),
    supabase
      .from('deals')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(10),
  ])

  if (dealsRes.error) {
    console.error('Error fetching deals:', dealsRes.error)
    return { total: 0, byStage: {}, recentDeals: [], pendingReviews: 0, recentActivity: [] }
  }

  const dealList: Deal[] = dealsRes.data || []
  const recentDealsList: Deal[] = recentDealsRes.data || []

  const byStage = dealList.reduce((acc, deal) => {
    const stage = deal.stage || 'unknown'
    acc[stage] = (acc[stage] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Generate activity from recent deals
  const recentActivity = recentDealsList.slice(0, 5).map(deal => ({
    id: deal.id,
    type: 'deal_created' as const,
    title: deal.company || deal.name,
    subtitle: formatStageName(deal.stage || 'unknown'),
    timestamp: formatRelativeTime(new Date(deal.updated_at || deal.created_at)),
  }))

  return {
    total: dealList.length,
    byStage,
    recentDeals: recentDealsList.slice(0, 5),
    pendingReviews: reviewsRes.data?.length || 0,
    recentActivity,
  }
}

export const revalidate = 0

export default async function Dashboard() {
  const [stats, tasksDueSoon, tasksDueToday] = await Promise.all([
    getDashboardStats(),
    getTasksDueSoon(),
    getTasksDueToday(),
  ])

  const stageOrder = ['lead', 'discovery', 'evaluation', 'negotiation', 'closed_won', 'closed_lost']
  const orderedStages = stageOrder.filter(stage => stats.byStage[stage] !== undefined)
  const otherStages = Object.keys(stats.byStage).filter(stage => !stageOrder.includes(stage))
  const allStages = [...orderedStages, ...otherStages]

  return (
    <div className="dashboard">
      {/* Greeting Section */}
      <Greeting
        pendingReviews={stats.pendingReviews}
        tasksDueToday={tasksDueToday.length}
      />

      {/* Quick Actions */}
      <QuickActions />

      {/* Main Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Left Column */}
        <div className="dashboard-main">
          {/* Stat Cards */}
          <div className="stats-grid-compact">
            <div className="stat-card-enhanced">
              <h3>Total Deals</h3>
              <div className="value">{stats.total}</div>
            </div>
            {allStages.slice(0, 5).map(stage => (
              <div className="stat-card-enhanced" key={stage}>
                <h3>{formatStageName(stage)}</h3>
                <div className="value">{stats.byStage[stage]}</div>
              </div>
            ))}
          </div>

          {/* Recent Deals */}
          <div className="card">
            <div className="card-header-row">
              <h2>Recent Deals</h2>
              <Link href="/deals" className="card-link">
                View all →
              </Link>
            </div>
            {stats.recentDeals.length > 0 ? (
              <div className="table-container" style={{ border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Stage</th>
                      <th>Next Step</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentDeals.map(deal => (
                      <tr key={deal.id} className="clickable-row">
                        <td>
                          <Link href={`/deals/${deal.id}`} className="deal-link-cell">
                            {deal.company || deal.name}
                          </Link>
                        </td>
                        <td>
                          <span className={`stage-pill ${deal.stage || ''}`}>
                            {formatStageName(deal.stage || 'unknown')}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {deal.next_step || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">No deals yet</div>
            )}
          </div>

          {/* Tasks Due Soon */}
          <div className="card">
            <div className="card-header-row">
              <h2>Tasks Due Soon</h2>
              <Link href="/tasks" className="card-link">
                View all →
              </Link>
            </div>
            {tasksDueSoon.length > 0 ? (
              <div className="task-list-compact">
                {tasksDueSoon.slice(0, 5).map((task: AsanaTask) => {
                  const overdue = isTaskOverdue(task)
                  return (
                    <div
                      key={task.gid}
                      className={`task-item-compact ${overdue ? 'overdue' : ''}`}
                    >
                      <div className="task-item-content">
                        <div className="task-item-name">{task.name}</div>
                        {task.assignee && (
                          <div className="task-item-assignee">{task.assignee.name}</div>
                        )}
                      </div>
                      <div className={`task-item-due ${overdue ? 'overdue' : ''}`}>
                        {overdue && '⚠ '}
                        {task.due_on
                          ? new Date(task.due_on).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'No date'}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '30px' }}>
                No tasks due soon
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Widgets */}
        <div className="dashboard-sidebar">
          <PendingReviewsWidget count={stats.pendingReviews} />
          <TasksDueTodayWidget tasks={tasksDueToday} />
          <ActivityFeedWidget activities={stats.recentActivity} />
        </div>
      </div>
    </div>
  )
}
