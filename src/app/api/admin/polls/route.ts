import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { add } from 'date-fns';

// GET /api/admin/polls - Get all polls
export async function GET() {
  try {
    const polls = await prisma.poll.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { votes: true },
        },
      },
    });

    return NextResponse.json(polls);
  } catch (error) {
    console.error('Error fetching polls:', error);
    return NextResponse.json({ message: 'Failed to fetch polls' }, { status: 500 });
  }
}

// POST /api/admin/polls - Create a new poll
export async function POST(request: NextRequest) {
  try {
    const { question, category, customCategory } = await request.json();
    
    if (!question) {
      return NextResponse.json({ message: 'Question is required' }, { status: 400 });
    }

    // Validate category
    const validCategories = ['general', 'politics', 'technology', 'culture', 'climate', 'custom'];
    const finalCategory = category && validCategories.includes(category) ? category : 'general';
    
    // Validate customCategory if category is custom
    const finalCustomCategory = finalCategory === 'custom' && customCategory ? customCategory : null;

    // Deactivate all current active polls
    await prisma.poll.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Create a new poll that expires in 24 hours
    const expiresAt = add(new Date(), { hours: 24 });
    
    const newPoll = await prisma.poll.create({
      data: {
        question,
        category: finalCategory,
        customCategory: finalCustomCategory,
        expiresAt,
        isActive: true,
      },
    });

    return NextResponse.json(newPoll, { status: 201 });
  } catch (error) {
    console.error('Error creating poll:', error);
    return NextResponse.json({ message: 'Failed to create poll' }, { status: 500 });
  }
} 