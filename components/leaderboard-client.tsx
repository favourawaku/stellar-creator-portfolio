'use client';

import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, Award, Trophy, Sparkles, TrendingUp, Compass } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export interface CreatorLeaderboardItem {
  id: string;
  userId: string;
  displayName: string;
  avatar: string | null;
  discipline: string | null;
  skills: string[];
  rating: number;
  completedProjects: number;
  earnings: number;
  createdAt: string;
}

interface LeaderboardClientProps {
  creators: CreatorLeaderboardItem[];
  currentUserId: string | null;
}

export function LeaderboardClient({ creators, currentUserId }: LeaderboardClientProps) {
  const [activeTab, setActiveTab] = useState<'discipline' | 'earnings' | 'rising_stars'>('discipline');
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('all');

  // Format earnings as range/obfuscated strings (e.g., "$10,XXX+ earned")
  const formatEarnings = (amount: number) => {
    if (amount <= 0) return '$0 earned';
    if (amount < 1000) return 'Under $1,000 earned';
    if (amount < 5000) return '$1,000 - $5,000 earned';
    if (amount < 10000) return '$5,000 - $10,000 earned';
    const thousands = Math.floor(amount / 1000);
    return `$${thousands},XXX+ earned`;
  };

  // Get unique disciplines
  const disciplines = useMemo(() => {
    const list = new Set(creators.map(c => c.discipline).filter(Boolean) as string[]);
    return ['all', ...Array.from(list)];
  }, [creators]);

  // Compute lists and ranks
  const processedLists = useMemo(() => {
    // 1. Discipline List (sorted by rating desc, then projects completed desc)
    let disciplineList = [...creators];
    if (selectedDiscipline !== 'all') {
      disciplineList = disciplineList.filter(c => c.discipline?.toLowerCase() === selectedDiscipline.toLowerCase());
    }
    disciplineList.sort((a, b) => b.rating - a.rating || b.completedProjects - a.completedProjects);

    // 2. Earnings List (sorted by earnings desc)
    const earningsList = [...creators].sort((a, b) => b.earnings - a.earnings);

    // 3. Rising Stars List (created within last 90 days, sorted by rating desc)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const risingStarsList = creators
      .filter(c => new Date(c.createdAt) >= ninetyDaysAgo)
      .sort((a, b) => b.rating - a.rating || b.completedProjects - a.completedProjects);

    return {
      discipline: disciplineList,
      earnings: earningsList,
      rising_stars: risingStarsList,
    };
  }, [creators, selectedDiscipline]);

  const currentList = processedLists[activeTab];
  const top20 = currentList.slice(0, 20);

  // Find current user's rank
  const ownRankInfo = useMemo(() => {
    if (!currentUserId) return null;
    const index = currentList.findIndex(c => c.userId === currentUserId);
    if (index === -1) return null;
    return {
      rank: index + 1,
      creator: currentList[index],
      inTop20: index < 20,
    };
  }, [currentList, currentUserId]);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-amber-400" />;
    if (rank === 2) return <Award className="h-5 w-5 text-slate-300" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-700" />;
    return <span className="text-muted-foreground font-mono text-sm">{rank}</span>;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 py-8">
      <div className="text-center space-y-2 mb-8">
        <Badge variant="outline" className="px-3 py-1 border-indigo-500/30 text-indigo-400 gap-1 bg-indigo-500/5">
          <Sparkles className="h-3.5 w-3.5" /> Recognition System
        </Badge>
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent sm:text-5xl">
          Creator Leaderboards
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto text-sm">
          Discover top-performing talent, rising stars, and proven industry experts on the network.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full sm:w-auto">
          <TabsList className="bg-muted/50 border border-border/50">
            <TabsTrigger value="discipline" className="gap-1.5">
              <Compass className="h-4 w-4" /> Top by Discipline
            </TabsTrigger>
            <TabsTrigger value="earnings" className="gap-1.5">
              <TrendingUp className="h-4 w-4" /> Top Earners
            </TabsTrigger>
            <TabsTrigger value="rising_stars" className="gap-1.5">
              <Sparkles className="h-4 w-4" /> Rising Stars
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'discipline' && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {disciplines.map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDiscipline(d)}
                className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all whitespace-nowrap capitalize ${
                  selectedDiscipline === d
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground'
                }`}
              >
                {d === 'all' ? 'All Disciplines' : d}
              </button>
            ))}
          </div>
        )}
      </div>

      <Card className="bg-card/30 backdrop-blur-xl border border-border/50 shadow-xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-16 text-center">Rank</TableHead>
                <TableHead>Creator</TableHead>
                <TableHead>Discipline</TableHead>
                <TableHead className="text-center">Projects Completed</TableHead>
                <TableHead className="text-center">Rating</TableHead>
                <TableHead className="text-right">Earnings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top20.map((creator, idx) => {
                const rank = idx + 1;
                const isCurrentUser = currentUserId === creator.userId;
                return (
                  <TableRow
                    key={creator.id}
                    className={`transition-colors hover:bg-muted/10 ${
                      isCurrentUser ? 'bg-indigo-500/5 hover:bg-indigo-500/10 font-medium' : ''
                    }`}
                  >
                    <TableCell className="text-center align-middle">{getRankBadge(rank)}</TableCell>
                    <TableCell className="align-middle">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-border">
                          <AvatarImage src={creator.avatar || ''} alt={creator.displayName} />
                          <AvatarFallback className="bg-indigo-500/10 text-indigo-400">
                            {creator.displayName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-foreground truncate flex items-center gap-1.5">
                            {creator.displayName}
                            {isCurrentUser && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                You
                              </Badge>
                            )}
                          </span>
                          <div className="flex gap-1 flex-wrap mt-0.5">
                            {creator.skills.slice(0, 2).map(skill => (
                              <Badge key={skill} variant="outline" className="text-[10px] text-muted-foreground border-border/50 py-0 px-1">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-middle capitalize">{creator.discipline || '—'}</TableCell>
                    <TableCell className="text-center align-middle font-mono text-sm">
                      {creator.completedProjects}
                    </TableCell>
                    <TableCell className="text-center align-middle">
                      <div className="flex items-center justify-center gap-1">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="font-mono text-sm font-semibold">{(creator.rating / 100).toFixed(1)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right align-middle font-mono text-sm text-indigo-400">
                      {formatEarnings(creator.earnings)}
                    </TableCell>
                  </TableRow>
                );
              })}

              {top20.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                    No creators found on the leaderboard list.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Locked/pinned row for current user if outside Top 20 */}
          {ownRankInfo && !ownRankInfo.inTop20 && (
            <div className="border-t-2 border-dashed border-border/80 bg-indigo-950/20 backdrop-blur px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <span className="text-indigo-400 font-bold font-mono text-sm shrink-0 w-8 text-center">
                  #{ownRankInfo.rank}
                </span>
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-9 w-9 border border-indigo-500/20">
                    <AvatarImage src={ownRankInfo.creator.avatar || ''} alt={ownRankInfo.creator.displayName} />
                    <AvatarFallback className="bg-indigo-500/20 text-indigo-300">
                      {ownRankInfo.creator.displayName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-semibold text-indigo-300 flex items-center gap-1.5">
                      {ownRankInfo.creator.displayName}
                      <Badge variant="outline" className="text-[10px] text-indigo-300 border-indigo-400/20 bg-indigo-500/10">
                        You
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {ownRankInfo.creator.discipline || '—'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6 shrink-0 font-mono text-sm">
                <div className="hidden sm:block text-center">
                  <span className="text-muted-foreground text-xs block">Projects</span>
                  <span className="text-foreground">{ownRankInfo.creator.completedProjects}</span>
                </div>
                <div className="text-center">
                  <span className="text-muted-foreground text-xs block">Rating</span>
                  <div className="flex items-center gap-0.5 justify-center">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span>{(ownRankInfo.creator.rating / 100).toFixed(1)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground text-xs block">Earnings</span>
                  <span className="text-indigo-300 font-semibold">{formatEarnings(ownRankInfo.creator.earnings)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
