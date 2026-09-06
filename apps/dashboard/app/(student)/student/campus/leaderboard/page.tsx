'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { 
  useGlobalStudentLeaderboard, 
  useGlobalClubLeaderboard
} from '../../../../../hooks/useLeaderboard';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';

type Tab = 'students' | 'clubs';

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('students');
  const { data: currentUser } = useCurrentUser();

  const {
    data: studentsData,
    isLoading: isStudentsLoading,
    fetchNextPage: fetchNextStudents,
    hasNextPage: hasNextStudents,
    isFetchingNextPage: isFetchingNextStudents
  } = useGlobalStudentLeaderboard();

  const {
    data: clubsData,
    isLoading: isClubsLoading,
    fetchNextPage: fetchNextClubs,
    hasNextPage: hasNextClubs,
    isFetchingNextPage: isFetchingNextClubs
  } = useGlobalClubLeaderboard();

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const padRank = (rank: number) => {
    return rank.toString().padStart(2, '0');
  };

  const renderLoadingState = () => {
    return (
      <div className="w-full">
        <div className="mb-stitch-xl grid grid-cols-1 md:grid-cols-3 gap-stitch-md">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-stitch-outline-variant p-stitch-lg h-48 animate-pulse bg-stitch-surface-variant/30 flex flex-col justify-end">
              <div className="h-6 bg-stitch-surface-variant w-1/2 mb-4"></div>
              <div className="h-10 bg-stitch-surface-variant w-3/4"></div>
            </div>
          ))}
        </div>
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 border-b border-stitch-outline-variant flex items-center">
              <div className="h-6 w-1/4 bg-stitch-surface-variant"></div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderEmptyState = (label: string) => {
    return (
      <div className="py-stitch-xxl flex flex-col items-center justify-center text-center">
        <h3 className="stitch-text-headline-lg text-stitch-on-background mb-stitch-sm">No {label} ranked yet</h3>
        <p className="stitch-text-body-lg text-stitch-secondary mb-stitch-xl">Check back later when activity begins.</p>
      </div>
    );
  };

  const students = studentsData?.pages.flatMap(p => p.data) || [];
  const top3Students = students.filter(s => s.rank <= 3);
  const restStudents = students.filter(s => s.rank > 3);

  const clubs = clubsData?.pages.flatMap(p => p.data) || [];
  const top3Clubs = clubs.filter(c => c.rank <= 3);
  const restClubs = clubs.filter(c => c.rank > 3);

  return (
    <div className="w-full px-stitch-margin-mobile md:px-stitch-margin-desktop pt-stitch-xl pb-stitch-xxl bg-stitch-background min-h-screen">
      
      {/* Header section */}
      <section className="mb-stitch-xxl">
        <h1 className="stitch-text-display-lg-mobile md:stitch-text-display-lg text-stitch-on-background uppercase mb-stitch-xs tracking-tight">
          Leaderboard
        </h1>
        <p className="stitch-text-body-lg text-stitch-secondary">
          Recognizing the most active contributors in our campus community.
        </p>
      </section>

      {/* Tabs Row */}
      <section className="flex items-center gap-stitch-xl border-b border-stitch-outline-variant mb-stitch-xl overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('students')}
          className={clsx(
            "stitch-text-label-mono uppercase tracking-widest pb-3 transition-colors whitespace-nowrap",
            activeTab === 'students' 
              ? "text-stitch-on-background border-b-2 border-stitch-on-background font-bold" 
              : "text-stitch-secondary hover:text-stitch-on-background"
          )}
        >
          Students
        </button>
        <button
          onClick={() => setActiveTab('clubs')}
          className={clsx(
            "stitch-text-label-mono uppercase tracking-widest pb-3 transition-colors whitespace-nowrap",
            activeTab === 'clubs' 
              ? "text-stitch-on-background border-b-2 border-stitch-on-background font-bold" 
              : "text-stitch-secondary hover:text-stitch-on-background"
          )}
        >
          Clubs
        </button>
      </section>

      {/* Leaderboard Content */}
      {activeTab === 'students' && (
        <div className="animate-in fade-in duration-300">
          {isStudentsLoading ? (
            renderLoadingState()
          ) : students.length === 0 ? (
            renderEmptyState('students')
          ) : (
            <>
              {/* TOP 3 */}
              {top3Students.length > 0 && (
                <section className="mb-stitch-xxl">
                  <h2 className="stitch-text-label-mono uppercase text-stitch-secondary tracking-widest mb-stitch-lg">
                    Top 3 Performers
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-stitch-md">
                    {top3Students.map(student => {
                      const isMe = student.user_id === currentUser?.id;
                      const isFirst = student.rank === 1;
                      
                      return (
                        <div key={student.user_id} className="relative border border-stitch-outline-variant p-stitch-lg h-[240px] flex flex-col justify-end bg-stitch-surface-container-lowest overflow-hidden group">
                          {/* Giant faint rank */}
                          <div className="absolute top-stitch-sm right-stitch-md text-[96px] font-stitch-headline font-bold leading-none text-stitch-surface-variant opacity-30 select-none">
                            {padRank(student.rank)}
                          </div>
                          
                          <div className="relative z-10 flex flex-col gap-2">
                            <h3 className={clsx(
                              "font-stitch-headline text-[24px] uppercase font-bold leading-none break-words line-clamp-2",
                              isMe ? "text-stitch-on-background" : "text-stitch-on-background"
                            )}>
                              {student.display_name} {isMe && <span className="text-stitch-primary">(You)</span>}
                            </h3>
                            <div className="flex items-end justify-between mt-stitch-md">
                              <span className={clsx(
                                "font-stitch-display text-[40px] leading-none font-bold tracking-tighter",
                                isFirst ? "text-stitch-primary" : "text-stitch-on-background"
                              )}>
                                {formatNumber(student.total_points)}
                              </span>
                              <span className="stitch-text-label-mono text-stitch-secondary mb-1">PTS</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* TABLE */}
              {restStudents.length > 0 && (
                <section>
                  <div className="grid grid-cols-12 pb-stitch-sm border-b border-stitch-outline-variant stitch-text-label-mono uppercase tracking-widest text-stitch-secondary">
                    <div className="col-span-2 sm:col-span-1">Rank</div>
                    <div className="col-span-7 sm:col-span-8">Name</div>
                    <div className="col-span-3 text-right">Points</div>
                  </div>
                  
                  <div className="flex flex-col">
                    {restStudents.map(student => {
                      const isMe = student.user_id === currentUser?.id;
                      return (
                        <div key={student.user_id} className="grid grid-cols-12 py-stitch-md items-center border-b border-stitch-outline-variant hover:bg-stitch-surface/50 transition-colors">
                          <div className="col-span-2 sm:col-span-1 font-stitch-headline font-bold text-xl text-stitch-on-background">
                            {padRank(student.rank)}
                          </div>
                          <div className="col-span-7 sm:col-span-8 flex items-center">
                            <span className={clsx(
                              "font-stitch-headline text-lg uppercase leading-none truncate pr-4",
                              isMe ? "font-bold text-stitch-primary" : "text-stitch-on-background"
                            )}>
                              {student.display_name} {isMe && "(You)"}
                            </span>
                          </div>
                          <div className="col-span-3 text-right stitch-text-label-mono tracking-widest text-stitch-secondary">
                            {formatNumber(student.total_points)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* LOAD MORE */}
              {hasNextStudents && (
                <div className="mt-stitch-xl flex justify-center">
                  <button 
                    onClick={() => fetchNextStudents()} 
                    disabled={isFetchingNextStudents}
                    className="border border-stitch-outline text-stitch-on-background stitch-text-label-mono uppercase tracking-widest px-stitch-lg py-stitch-md hover:bg-stitch-surface transition-colors disabled:opacity-50"
                  >
                    {isFetchingNextStudents ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* CLUBS TAB */}
      {activeTab === 'clubs' && (
        <div className="animate-in fade-in duration-300">
          {isClubsLoading ? (
            renderLoadingState()
          ) : clubs.length === 0 ? (
            renderEmptyState('clubs')
          ) : (
            <>
              {/* TOP 3 CLUBS */}
              {top3Clubs.length > 0 && (
                <section className="mb-stitch-xxl">
                  <h2 className="stitch-text-label-mono uppercase text-stitch-secondary tracking-widest mb-stitch-lg">
                    Top 3 Performers
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-stitch-md">
                    {top3Clubs.map(club => {
                      const isFirst = club.rank === 1;
                      
                      return (
                        <div key={club.club_id} className="relative border border-stitch-outline-variant p-stitch-lg h-[240px] flex flex-col justify-end bg-stitch-surface-container-lowest overflow-hidden group">
                          {/* Giant faint rank */}
                          <div className="absolute top-stitch-sm right-stitch-md text-[96px] font-stitch-headline font-bold leading-none text-stitch-surface-variant opacity-30 select-none">
                            {padRank(club.rank)}
                          </div>
                          
                          <div className="relative z-10 flex flex-col gap-2">
                            <h3 className="font-stitch-headline text-[24px] uppercase font-bold leading-none break-words line-clamp-2 text-stitch-on-background">
                              {club.club_name}
                            </h3>
                            <div className="flex items-end justify-between mt-stitch-md">
                              <span className={clsx(
                                "font-stitch-display text-[40px] leading-none font-bold tracking-tighter",
                                isFirst ? "text-stitch-primary" : "text-stitch-on-background"
                              )}>
                                {formatNumber(club.total_points)}
                              </span>
                              <span className="stitch-text-label-mono text-stitch-secondary mb-1">PTS</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* CLUBS TABLE */}
              {restClubs.length > 0 && (
                <section>
                  <div className="grid grid-cols-12 pb-stitch-sm border-b border-stitch-outline-variant stitch-text-label-mono uppercase tracking-widest text-stitch-secondary">
                    <div className="col-span-2 sm:col-span-1">Rank</div>
                    <div className="col-span-7 sm:col-span-8">Club</div>
                    <div className="col-span-3 text-right">Points</div>
                  </div>
                  
                  <div className="flex flex-col">
                    {restClubs.map(club => {
                      return (
                        <div key={club.club_id} className="grid grid-cols-12 py-stitch-md items-center border-b border-stitch-outline-variant hover:bg-stitch-surface/50 transition-colors">
                          <div className="col-span-2 sm:col-span-1 font-stitch-headline font-bold text-xl text-stitch-on-background">
                            {padRank(club.rank)}
                          </div>
                          <div className="col-span-7 sm:col-span-8 flex items-center">
                            <span className="font-stitch-headline text-lg uppercase leading-none truncate pr-4 text-stitch-on-background">
                              {club.club_name}
                            </span>
                          </div>
                          <div className="col-span-3 text-right stitch-text-label-mono tracking-widest text-stitch-secondary">
                            {formatNumber(club.total_points)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* LOAD MORE */}
              {hasNextClubs && (
                <div className="mt-stitch-xl flex justify-center">
                  <button 
                    onClick={() => fetchNextClubs()} 
                    disabled={isFetchingNextClubs}
                    className="border border-stitch-outline text-stitch-on-background stitch-text-label-mono uppercase tracking-widest px-stitch-lg py-stitch-md hover:bg-stitch-surface transition-colors disabled:opacity-50"
                  >
                    {isFetchingNextClubs ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
