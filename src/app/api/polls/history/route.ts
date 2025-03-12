import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/polls/history - Get historical polls
export async function GET() {
  try {
    // Instead of multiple separate queries, use a more efficient approach
    // Get all historical polls in a single query
    const historicalPolls = await prisma.poll.findMany({
      where: {
        isActive: false,
      },
      orderBy: {
        createdAt: 'desc', // Most recent first
      },
    });

    // Get all votes for these polls in a single query
    const pollIds = historicalPolls.map(poll => poll.id);
    const allVotes = await prisma.vote.groupBy({
      by: ['pollId', 'answer'],
      where: {
        pollId: {
          in: pollIds,
        },
      },
      _count: {
        id: true,
      },
    });

    // Process the results efficiently
    const pollsWithStats = historicalPolls.map(poll => {
      // Find yes and no votes for this poll
      const yesVotesRecord = allVotes.find(
        v => v.pollId === poll.id && v.answer === true
      );
      const noVotesRecord = allVotes.find(
        v => v.pollId === poll.id && v.answer === false
      );

      const yesVotes = yesVotesRecord ? yesVotesRecord._count.id : 0;
      const noVotes = noVotesRecord ? noVotesRecord._count.id : 0;
      
      const totalVotes = yesVotes + noVotes;
      const yesPercentage = totalVotes > 0 ? Math.round((yesVotes / totalVotes) * 100) : 0;
      const noPercentage = totalVotes > 0 ? Math.round((noVotes / totalVotes) * 100) : 0;

      return {
        id: poll.id,
        question: poll.question,
        category: poll.category || 'general',
        customCategory: poll.customCategory || null,
        createdAt: poll.createdAt,
        expiresAt: poll.expiresAt,
        statistics: {
          totalVotes,
          yesVotes,
          noVotes,
          yesPercentage,
          noPercentage,
        },
      };
    });

    return NextResponse.json(pollsWithStats);
  } catch (error) {
    console.error('Error fetching historical polls:', error);
    return NextResponse.json(
      { message: 'Failed to fetch historical polls' },
      { status: 500 }
    );
  }
} 