import { NextResponse } from 'next/server';
import { checkAndArchiveExpiredPolls } from '@/lib/pollScheduler';

// This endpoint can be called by a cron job service like Vercel Cron
// or manually triggered for development
export async function GET() {
  try {
    await checkAndArchiveExpiredPolls();
    return NextResponse.json({ message: 'Checked and archived expired polls' });
  } catch (error) {
    console.error('Error in cron job:', error);
    return NextResponse.json(
      { message: 'Failed to process expired polls' },
      { status: 500 }
    );
  }
} 