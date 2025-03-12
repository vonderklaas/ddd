import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function GET(_: Request, { params }: any) {
  const id = params.id;
  
  try {
    const poll = await prisma.poll.findUnique({
      where: { id },
      include: {
        votes: {
          select: {
            id: true,
            answer: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!poll) {
      return NextResponse.json({ message: 'Poll not found' }, { status: 404 });
    }

    return NextResponse.json(poll);
  } catch (error) {
    console.error('Error fetching poll:', error);
    return NextResponse.json(
      { message: 'Failed to fetch poll' }, 
      { status: 500 }
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function PATCH(request: Request, { params }: any) {
  const id = params.id;
  
  try {
    const body = await request.json();
    const { question, isActive } = body;
    
    // Check if poll exists
    const existingPoll = await prisma.poll.findUnique({
      where: { id },
    });

    if (!existingPoll) {
      return NextResponse.json({ message: 'Poll not found' }, { status: 404 });
    }

    // If setting a poll to active, deactivate all other polls
    if (isActive) {
      await prisma.poll.updateMany({
        where: { id: { not: id } },
        data: { isActive: false },
      });
    }

    // Update the poll
    const updatedPoll = await prisma.poll.update({
      where: { id },
      data: {
        question: question || undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    return NextResponse.json(updatedPoll);
  } catch (error) {
    console.error('Error updating poll:', error);
    return NextResponse.json(
      { message: 'Failed to update poll' }, 
      { status: 500 }
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function DELETE(_: Request, { params }: any) {
  const id = params.id;
  
  try {
    // Check if poll exists
    const existingPoll = await prisma.poll.findUnique({
      where: { id },
    });

    if (!existingPoll) {
      return NextResponse.json({ message: 'Poll not found' }, { status: 404 });
    }

    // Use a transaction to ensure all deletions succeed or fail together
    await prisma.$transaction([
      // Delete all related comments first
      prisma.$executeRaw`DELETE FROM "Comment" WHERE "pollId" = ${id}`,
      
      // Delete all related votes
      prisma.$executeRaw`DELETE FROM "Vote" WHERE "pollId" = ${id}`,
      
      // Now it's safe to delete the poll
      prisma.$executeRaw`DELETE FROM "Poll" WHERE "id" = ${id}`
    ]);

    return NextResponse.json({ message: 'Poll deleted successfully' });
  } catch (error) {
    console.error('Error deleting poll:', error);
    return NextResponse.json(
      { message: 'Failed to delete poll' }, 
      { status: 500 }
    );
  }
} 