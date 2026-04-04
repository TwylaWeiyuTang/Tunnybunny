import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db/sqlite';
import { groupsRouter } from './routes/groups';
import { quotesRouter } from './routes/quotes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize database
initDb();

// Routes
app.use('/api/groups', groupsRouter);
app.use('/api/quotes', quotesRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(PORT, () => {
  console.log(`TunnyBunny backend running on port ${PORT}`);
});
