import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pollId = searchParams.get('pollId');
    const fingerprint = searchParams.get('fingerprint');
    
    if (!pollId) {
      return NextResponse.json({ message: 'Poll ID is required' }, { status: 400 });
    }
    
    // Get IP address
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
    
    // Check if user has already voted on this poll
    const existingVote = await prisma.vote.findFirst({
      where: {
        pollId,
        OR: [
          { ipAddress },
          ...(fingerprint ? [{ deviceFingerprint: fingerprint }] : [])
        ]
      },
    });

    if (existingVote) {
      return NextResponse.json({ 
        hasVoted: true,
        vote: existingVote.answer // true for YES, false for NO
      });
    }

    return NextResponse.json({ hasVoted: false });
  } catch (error) {
    console.error('Error checking vote status:', error);
    return NextResponse.json({ message: 'Failed to check vote status' }, { status: 500 });
  }
} 