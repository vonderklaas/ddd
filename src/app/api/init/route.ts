import { NextResponse } from 'next/server';
import { createDefaultAdminIfNeeded, checkAndArchiveExpiredPolls } from '@/lib/pollScheduler';

// This endpoint should be called during server startup or via cron
export async function GET() {
  try {
    // Create default admin user if needed
    await createDefaultAdminIfNeeded();
    
    // Check for expired polls and archive them
    await checkAndArchiveExpiredPolls();
    
    return NextResponse.json({ 
      message: 'Initialization completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error during initialization:', error);
    return NextResponse.json({
      message: 'Initialization failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 