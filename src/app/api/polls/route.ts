import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/polls - Get the current active poll
export async function GET() {
  try {
    // Find the active poll
    const activePoll = await prisma.poll.findFirst({
      where: {
        isActive: true,
      },
    });

    if (!activePoll) {
      return NextResponse.json({ message: 'No active poll found' }, { status: 404 });
    }

    // Get vote statistics in a single query using groupBy
    const voteStats = await prisma.vote.groupBy({
      by: ['answer'],
      where: {
        pollId: activePoll.id,
      },
      _count: {
        id: true,
      },
    });

    // Process vote statistics
    const yesVotesRecord = voteStats.find(v => v.answer === true);
    const noVotesRecord = voteStats.find(v => v.answer === false);
    
    const yesVotes = yesVotesRecord ? yesVotesRecord._count.id : 0;
    const noVotes = noVotesRecord ? noVotesRecord._count.id : 0;
    
    const totalVotes = yesVotes + noVotes;
    const yesPercentage = totalVotes > 0 ? Math.round((yesVotes / totalVotes) * 100) : 0;
    const noPercentage = totalVotes > 0 ? Math.round((noVotes / totalVotes) * 100) : 0;

    return NextResponse.json({
      id: activePoll.id,
      question: activePoll.question,
      category: activePoll.category || 'general',
      customCategory: activePoll.customCategory || null,
      createdAt: activePoll.createdAt,
      expiresAt: activePoll.expiresAt,
      statistics: {
        totalVotes,
        yesVotes,
        noVotes,
        yesPercentage,
        noPercentage,
      },
    });
  } catch (error) {
    console.error('Error fetching active poll:', error);
    return NextResponse.json({ message: 'Failed to fetch active poll' }, { status: 500 });
  }
} 