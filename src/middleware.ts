import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Store IP addresses and their request counts
// In a production environment, you would use Redis or a similar solution
const ipRequestMap = new Map<string, { count: number; lastReset: number }>();
const MAX_REQUESTS_PER_MINUTE = 30; // Adjust as needed

export function middleware(request: NextRequest) {
  // Only apply rate limiting to vote API calls
  if (request.nextUrl.pathname === '/api/votes' && request.method === 'POST') {
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               '127.0.0.1';

    // Rate limiting logic
    const now = Date.now();
    const ipData = ipRequestMap.get(ip);
    
    if (!ipData) {
      // First request from this IP
      ipRequestMap.set(ip, { count: 1, lastReset: now });
    } else {
      // Check if we need to reset the counter (one minute has passed)
      if (now - ipData.lastReset > 60000) {
        ipRequestMap.set(ip, { count: 1, lastReset: now });
      } else {
        // Increment the counter
        ipData.count++;
        ipRequestMap.set(ip, ipData);
        
        // Check if the IP has exceeded the limit
        if (ipData.count > MAX_REQUESTS_PER_MINUTE) {
          return new NextResponse(
            JSON.stringify({ message: 'Too many requests, please try again later' }),
            { 
              status: 429, 
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': '60'
              } 
            }
          );
        }
      }
    }
    
    // Clean up old entries every hour
    if (ipRequestMap.size > 1000) {
      const hourAgo = now - 3600000;
      for (const [key, value] of ipRequestMap.entries()) {
        if (value.lastReset < hourAgo) {
          ipRequestMap.delete(key);
        }
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/votes'],
}; 