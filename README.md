# Global Poll

A full-stack application for real-time global polling with daily single-question polls on relevant topics. Users can vote YES or NO and see live results segmented by their choices.

## Features

- Daily single-question polls
- Real-time results showing YES/NO percentages
- IP-based voting (one vote per IP address)
- Vote changing allowed before poll expiration
- 24-hour poll duration
- Historical poll archive
- Admin panel for managing polls

## Tech Stack

- **Frontend**: Next.js, React, TailwindCSS
- **Backend**: Next.js API routes
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma

## Getting Started

### Prerequisites

- Node.js (>=18.0.0)
- npm or yarn
- PostgreSQL database (or Neon database URL)

### Installation

1. Clone the repository

```bash
git clone [your-repo-url]
cd global-poll-next
```

2. Install dependencies

```bash
npm install
# or
yarn install
```

3. Set up environment variables

Create a `.env` file in the root directory with the following variables:

```
DATABASE_URL="your-postgresql-connection-string"
```

4. Initialize the database

```bash
npx prisma db push
```

5. Run the development server

```bash
npm run dev
# or
yarn dev
```

6. Initialize the application

Open your browser and navigate to:
```
http://localhost:3000/api/init
```
This will create a default admin user with credentials:
- Username: `admin`
- Password: `admin123`

## Usage

- Visit `http://localhost:3000` to view and participate in the current poll
- Visit `http://localhost:3000/history` to view past polls
- Visit `http://localhost:3000/admin` to access the admin panel

## Deployment

This application can be easily deployed to platforms like Vercel:

```bash
npm run build
npm run start
```

## Maintaining the Application

### Poll Expiration

Polls automatically expire after 24 hours. The application includes two mechanisms to handle this:

1. A cron endpoint at `/api/cron` that can be called by services like Vercel Cron
2. Expiration checks when viewing polls

### Default Admin Credentials

- Username: `admin`
- Password: `admin123`

It's highly recommended to change these credentials after initial setup.

## License

[MIT](LICENSE)
