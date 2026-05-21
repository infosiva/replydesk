import BriefForm from '@/components/BriefForm'

export const metadata = { title: 'New Brief — ZeroStaff' }

export default function NewBriefPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">New brief</h1>
        <p className="text-sm text-white/50 mt-1">Fill in 3 fields. Get 8 content assets in ~60 seconds.</p>
      </div>
      <BriefForm />
    </div>
  )
}
