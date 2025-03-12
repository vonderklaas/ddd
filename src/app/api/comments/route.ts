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
    
    // Get the requester's IP and fingerprint
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
    const deviceFingerprint = request.headers.get('user-agent') || '';
    
    const comments = await prisma.comment.findMany({
      where: {
        pollId,
        // No hidden filter as it might not exist in the schema
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limit to 50 most recent comments
    });
    
    // Mark comments from the current user
    const commentsWithOwnership = comments.map(comment => {
      // Check if this comment belongs to the current user by IP or device fingerprint
      const isYours = comment.ipAddress === ipAddress || 
                     (deviceFingerprint && comment.deviceFingerprint === deviceFingerprint);
      
      // Return the comment with an isYours flag, but don't expose the IP address
      return {
        id: comment.id,
        pollId: comment.pollId,
        content: comment.content,
        answer: comment.answer,
        createdAt: comment.createdAt,
        isYours // Add this property to indicate if the comment is from the current user
      };
    });
    
    return NextResponse.json(commentsWithOwnership);
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
    
    // Check if user has already commented on this poll
    const existingComment = await prisma.comment.findFirst({
      where: {
        pollId,
        ipAddress,
      },
    });

    // Check if this device has already commented
    const existingDeviceComment = !existingComment && deviceIdentifier ? await prisma.comment.findFirst({
      where: {
        pollId,
        deviceFingerprint: deviceIdentifier,
      },
    }) : null;

    if (existingComment) {
      return NextResponse.json({ 
        message: 'You have already submitted a comment for this poll' 
      }, { status: 400 });
    }

    if (existingDeviceComment) {
      return NextResponse.json({ 
        message: 'You have already submitted a comment for this poll from this device' 
      }, { status: 400 });
    }
    
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