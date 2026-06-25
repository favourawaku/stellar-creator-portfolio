'use client'

import { useEffect, useState } from 'react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, DollarSign, Zap, AlertTriangle } from 'lucide-react'

export function BountyMetaRow({
  currency,
  budget,
  deadlineMs,
  status,
}: {
  currency: string
  budget: number
  deadlineMs: number
  status: string
}) {
  const [daysLeft, setDaysLeft] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState<{
    hours: number
    minutes: number
    seconds: number
    isUnder24h: boolean
  } | null>(null)

  useEffect(() => {
    const update = () => {
      const ms = deadlineMs - Date.now()
      if (ms <= 0) {
        setDaysLeft(0)
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isUnder24h: true })
        return
      }

      const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
      setDaysLeft(days)

      const totalSeconds = Math.floor(ms / 1000)
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60
      const isUnder24h = ms < 1000 * 60 * 60 * 24

      setTimeLeft({ hours, minutes, seconds, isUnder24h })
    }

    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [deadlineMs])

  return (
    <div className="space-y-4 mb-8">
      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <DollarSign className="h-4 w-4" /> Budget
            </CardDescription>
            <CardTitle className="text-2xl">
              {currency} {budget.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className={timeLeft?.isUnder24h ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : ''}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Calendar className="h-4 w-4" /> Deadline
            </CardDescription>
            <CardTitle className={`text-2xl font-mono ${timeLeft?.isUnder24h ? 'text-red-500 font-bold' : ''}`}>
              {daysLeft === null
                ? '—'
                : timeLeft?.isUnder24h
                ? `${timeLeft.hours.toString().padStart(2, '0')}h ${timeLeft.minutes
                    .toString()
                    .padStart(2, '0')}m ${timeLeft.seconds.toString().padStart(2, '0')}s`
                : `${daysLeft} days`}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Zap className="h-4 w-4" /> Status
            </CardDescription>
            <CardTitle className="text-2xl capitalize">{status}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {timeLeft?.isUnder24h && status === 'open' && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg p-4 text-sm flex items-start gap-3 animate-pulse">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold mb-0.5">Deadline Approaching</h4>
            <p className="text-red-500/90">
              This bounty is closing in less than 24 hours. Submit your applications or deliverables immediately to secure escrowed funds!
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
