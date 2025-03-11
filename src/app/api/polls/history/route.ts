import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/polls/history - Get historical polls
export async function GET() {
  try {
    // Find historical polls (not active)
    const historicalPolls = await prisma.poll.findMany({
      where: {
        isActive: false,
      },
      orderBy: {
        createdAt: 'desc', // Most recent first
      },
      include: {
        _count: {
          select: {
            votes: true,
          },
        },
      },
    });

    // Get vote statistics for each historical poll
    const pollsWithStats = await Promise.all(
      historicalPolls.map(async (poll) => {
        const yesVotes = await prisma.vote.count({
          where: {
            pollId: poll.id,
            answer: true,
          },
        });

        const noVotes = await prisma.vote.count({
          where: {
            pollId: poll.id,
            answer: false,
          },
        });

        const totalVotes = yesVotes + noVotes;
        const yesPercentage = totalVotes > 0 ? Math.round((yesVotes / totalVotes) * 100) : 0;
        const noPercentage = totalVotes > 0 ? Math.round((noVotes / totalVotes) * 100) : 0;

        return {
          id: poll.id,
          question: poll.question,
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
      })
    );

    return NextResponse.json(pollsWithStats);
  } catch (error) {
    console.error('Error fetching historical polls:', error);
    return NextResponse.json(
      { message: 'Failed to fetch historical polls' },
      { status: 500 }
    );
  }
} 