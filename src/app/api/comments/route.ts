import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/comments?pollId=xxx - Get comments for a poll
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pollId = searchParams.get('pollId');
    const deviceId = searchParams.get('deviceId'); // Get the device ID if provided
    
    if (!pollId) {
      return NextResponse.json({ message: 'Poll ID is required' }, { status: 400 });
    }
    
    // Get the requester's IP and fingerprint
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
    
    const comments = await prisma.comment.findMany({
      where: {
        pollId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limit to 50 most recent comments
    });
    
    // Mark comments from the current user
    const commentsWithOwnership = comments.map(comment => {
      // Check if this comment belongs to the current user
      const isYours = 
        // First try to match by device ID
        (deviceId && comment.deviceFingerprint?.includes(deviceId)) ||
        // Fall back to IP address match if no device ID match
        (!deviceId && comment.ipAddress === ipAddress);
      
      // Return the comment with an isYours flag, but don't expose the IP address
      return {
        id: comment.id,
        pollId: comment.pollId,
        content: comment.content,
        answer: comment.answer,
        createdAt: comment.createdAt,
        isYours
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
    const { pollId, content, answer, fingerprint, deviceId } = await request.json();
    
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
    
    // Store deviceId in deviceFingerprint temporarily until schema is updated
    // Combine it with the fingerprint to ensure uniqueness
    const deviceFingerprint = deviceId ? `${deviceId}|${fingerprint || request.headers.get('user-agent') || ''}` : 
                             (fingerprint || request.headers.get('user-agent') || '');
    
    // Check if user has already commented on this poll
    let existingComment = null;
    
    // Try to find using device fingerprint that contains deviceId
    if (deviceId) {
      const deviceFingerValue = `${deviceId}|${request.headers.get('user-agent') || ''}`;
      existingComment = await prisma.comment.findFirst({
        where: {
          pollId,
          deviceFingerprint: deviceFingerValue,
        },
      });
    }
    
    // If no match, fall back to IP address
    if (!existingComment) {
      existingComment = await prisma.comment.findFirst({
        where: {
          pollId,
          ipAddress,
        },
      });
    }

    // Also check by user agent/fingerprint
    const existingDeviceComment = !existingComment && deviceFingerprint ? await prisma.comment.findFirst({
      where: {
        pollId,
        deviceFingerprint,
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
        deviceFingerprint, // Store combined deviceId and fingerprint here
      },
    });
    
    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ message: 'Failed to create comment' }, { status: 500 });
  }
} 