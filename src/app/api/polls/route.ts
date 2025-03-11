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
      include: {
        // Include vote counts
        _count: {
          select: {
            votes: true,
          },
        },
      },
    });

    if (!activePoll) {
      return NextResponse.json({ message: 'No active poll found' }, { status: 404 });
    }

    // Get vote statistics
    const yesVotes = await prisma.vote.count({
      where: {
        pollId: activePoll.id,
        answer: true,
      },
    });

    const noVotes = await prisma.vote.count({
      where: {
        pollId: activePoll.id,
        answer: false,
      },
    });

    const totalVotes = yesVotes + noVotes;
    const yesPercentage = totalVotes > 0 ? Math.round((yesVotes / totalVotes) * 100) : 0;
    const noPercentage = totalVotes > 0 ? Math.round((noVotes / totalVotes) * 100) : 0;

    return NextResponse.json({
      id: activePoll.id,
      question: activePoll.question,
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