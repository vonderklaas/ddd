import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

interface VotePayload {
  pollId: string;
  answer: boolean | string;
  fingerprint?: string; // Client-provided fingerprint
}

// Define interfaces for Prisma operations with deviceFingerprint
interface VoteWhereInput {
  pollId: string;
  ipAddress?: string;
  deviceFingerprint?: string;
}

interface VoteCreateInput {
  pollId: string;
  ipAddress: string;
  deviceFingerprint?: string;
  answer: boolean;
}

// POST /api/votes - Submit a vote
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json() as VotePayload;
    const { pollId, answer, fingerprint } = payload;
    
    if (!pollId || answer === undefined) {
      return NextResponse.json(
        { message: 'Poll ID and answer are required' },
        { status: 400 }
      );
    }

    // Get client IP address
    let ipAddress = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip');
    
    // Fallback for local development
    if (!ipAddress) ipAddress = '127.0.0.1';
    
    // If multiple IPs are provided, use the first one
    if (ipAddress && ipAddress.includes(',')) {
      ipAddress = ipAddress.split(',')[0].trim();
    }

    // Generate a device identifier from various request headers
    const userAgent = request.headers.get('user-agent') || '';
    const accept = request.headers.get('accept') || '';
    const acceptLanguage = request.headers.get('accept-language') || '';
    
    // Create a unique device identifier by hashing browser characteristics
    // This helps identify the same device even if IP changes (e.g., mobile networks)
    const deviceIdentifier = crypto
      .createHash('sha256')
      .update(`${ipAddress}:${userAgent}:${accept}:${acceptLanguage}:${fingerprint || ''}`)
      .digest('hex');

    // Check if the poll exists and is active
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
    });

    if (!poll) {
      return NextResponse.json({ message: 'Poll not found' }, { status: 404 });
    }

    if (!poll.isActive) {
      return NextResponse.json(
        { message: 'This poll has expired' },
        { status: 400 }
      );
    }

    // Check if the device has already voted 
    // Use both IP and deviceIdentifier to be extra careful
    const existingVote = await prisma.vote.findFirst({
      where: {
        pollId,
        ipAddress,
      },
    });

    // Also check for any votes with the same device fingerprint for this poll
    // This catches users trying to vote twice from different networks
    const existingDeviceVote = !existingVote && deviceIdentifier ? await prisma.vote.findFirst({
      where: {
        pollId,
        deviceFingerprint: deviceIdentifier,
      } as VoteWhereInput,
    }) : null;

    // Get boolean value of answer
    const boolAnswer = answer === true || answer === 'true';

    if (existingVote) {
      // No longer allow vote updates - reject if already voted
      return NextResponse.json({
        message: 'You have already voted on this poll',
        voteId: existingVote.id,
      }, { status: 400 });
    } else if (existingDeviceVote) {
      // No longer allow vote updates - reject if already voted on this device
      return NextResponse.json({
        message: 'You have already voted on this poll from this device',
        voteId: existingDeviceVote.id,
      }, { status: 400 });
    } else {
      // Create new vote
      const newVote = await prisma.vote.create({
        data: {
          pollId,
          ipAddress,
          deviceFingerprint: deviceIdentifier, // Store the device identifier
          answer: boolAnswer,
        } as VoteCreateInput,
      });

      return NextResponse.json({
        message: 'Your vote has been recorded',
        voteId: newVote.id,
      });
    }
  } catch (error) {
    console.error('Error submitting vote:', error);
    return NextResponse.json(
      { message: 'Failed to submit vote' },
      { status: 500 }
    );
  }
} 