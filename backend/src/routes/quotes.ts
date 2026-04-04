import { Router } from 'express';

export const quotesRouter = Router();

const UNISWAP_API_BASE = 'https://trade-api.gateway.uniswap.org/v1';

// Proxy Uniswap quote requests (keeps API key server-side)
quotesRouter.post('/quote', async (req, res) => {
  const apiKey = process.env.UNISWAP_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Uniswap API key not configured' });
  }

  try {
    const response = await fetch(`${UNISWAP_API_BASE}/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'x-universal-router-version': '2.0',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Uniswap quote error:', error);
    res.status(502).json({ error: 'Failed to fetch quote from Uniswap' });
  }
});

// Proxy Uniswap swap requests
quotesRouter.post('/swap', async (req, res) => {
  const apiKey = process.env.UNISWAP_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Uniswap API key not configured' });
  }

  try {
    const response = await fetch(`${UNISWAP_API_BASE}/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'x-universal-router-version': '2.0',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Uniswap swap error:', error);
    res.status(502).json({ error: 'Failed to build swap from Uniswap' });
  }
});
