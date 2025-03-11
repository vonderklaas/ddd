import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type RouteParams = { params: { id: string } };

// GET /api/admin/polls/[id] - Get a specific poll
export async function GET(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id } = context.params;
    
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
    return NextResponse.json({ message: 'Failed to fetch poll' }, { status: 500 });
  }
}

// PATCH /api/admin/polls/[id] - Update a poll
export async function PATCH(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id } = context.params;
    const { question, isActive } = await request.json();
    
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
    return NextResponse.json({ message: 'Failed to update poll' }, { status: 500 });
  }
}

// DELETE /api/admin/polls/[id] - Delete a poll
export async function DELETE(
  request: NextRequest,
  context: RouteParams
) {
  try {
    const { id } = context.params;
    
    // Check if poll exists
    const existingPoll = await prisma.poll.findUnique({
      where: { id },
    });

    if (!existingPoll) {
      return NextResponse.json({ message: 'Poll not found' }, { status: 404 });
    }

    // Delete the poll and its votes
    await prisma.vote.deleteMany({
      where: { pollId: id },
    });
    
    await prisma.poll.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Poll deleted successfully' });
  } catch (error) {
    console.error('Error deleting poll:', error);
    return NextResponse.json({ message: 'Failed to delete poll' }, { status: 500 });
  }
} 