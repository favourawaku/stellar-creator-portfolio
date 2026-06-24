import { NextRequest, NextResponse } from 'next/server'
import { searchSkills } from '@/lib/skills-taxonomy'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') ?? ''
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '8', 10), 20)

  const skills = searchSkills(q, limit)
  return NextResponse.json({ skills, total: skills.length, query: q })
}
