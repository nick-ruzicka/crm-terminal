import { ReviewQueue } from '@/components/ReviewQueue'

export const dynamic = 'force-dynamic'

export default function ReviewPage() {
  return (
    <div>
      <div className="review-header">
        <h1>Review Queue</h1>
        <p className="review-subtitle">Classify meeting notes as potential deals</p>
      </div>
      <ReviewQueue />
    </div>
  )
}
