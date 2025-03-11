import prisma from './prisma';
import { isPast } from 'date-fns';

/**
 * Checks for expired polls and archives them
 * This function should be called periodically
 */
export async function checkAndArchiveExpiredPolls() {
  try {
    // Find active polls that have expired
    const activePolls = await prisma.poll.findMany({
      where: {
        isActive: true,
      },
    });

    // Check each poll to see if it's expired
    for (const poll of activePolls) {
      if (isPast(poll.expiresAt)) {
        // Archive the poll by setting isActive to false
        await prisma.poll.update({
          where: { id: poll.id },
          data: { isActive: false },
        });

        console.log(`Archived expired poll: ${poll.id}`);
      }
    }
  } catch (error) {
    console.error('Error checking for expired polls:', error);
  }
}

/**
 * Creates a default admin user if none exists
 * This is useful for initial setup
 */
export async function createDefaultAdminIfNeeded() {
  try {
    const adminCount = await prisma.admin.count();

    if (adminCount === 0) {
      // Create a default admin
      await prisma.admin.create({
        data: {
          username: 'admin',
          password: 'admin123', // This should be hashed in production
        },
      });
      console.log('Created default admin user');
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
} 