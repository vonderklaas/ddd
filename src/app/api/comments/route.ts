import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/comments?pollId=xxx - Get comments for a poll
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pollId = searchParams.get('pollId');
    
    if (!pollId) {
      return NextResponse.json({ message: 'Poll ID is required' }, { status: 400 });
    }
    
    const comments = await prisma.comment.findMany({
      where: {
        pollId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limit to 50 most recent comments
    });
    
    return NextResponse.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ message: 'Failed to fetch comments' }, { status: 500 });
  }
}

// POST /api/comments - Add a new comment
export async function POST(request: NextRequest) {
  try {
    const { pollId, content, answer, fingerprint } = await request.json();
    
    if (!pollId || content === undefined || answer === undefined) {
      return NextResponse.json({ message: 'Poll ID, content, and answer are required' }, { status: 400 });
    }
    
    // Validate content length (max 280 characters)
    if (content.length > 280) {
      return NextResponse.json({ message: 'Comment is too long (max 280 characters)' }, { status: 400 });
    }
    
    // Get IP address
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
    
    // Create device identifier
    const deviceIdentifier = fingerprint || request.headers.get('user-agent') || '';
    
    // Create the comment
    const comment = await prisma.comment.create({
      data: {
        pollId,
        content,
        answer: answer === true || answer === 'true',
        ipAddress,
        deviceFingerprint: deviceIdentifier,
      },
    });
    
    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ message: 'Failed to create comment' }, { status: 500 });
  }
} 