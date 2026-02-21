import { Router, Request, Response } from 'express'

const router = Router()
const CF_BASE = 'https://api.cloudflare.com/client/v4'

function cfHeaders() {
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN not configured')
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

// List zones
router.get('/zones', async (_req: Request, res: Response) => {
  try {
    const resp = await fetch(`${CF_BASE}/zones?per_page=50`, { headers: cfHeaders() })
    const data = await resp.json()
    res.status(resp.status).json(data)
  } catch (err: any) {
    res.status(500).json({ success: false, errors: [{ message: err.message }] })
  }
})

// List records for a zone
router.get('/zones/:zoneId/records', async (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params
    const resp = await fetch(`${CF_BASE}/zones/${zoneId}/dns_records?per_page=100`, { headers: cfHeaders() })
    const data = await resp.json()
    res.status(resp.status).json(data)
  } catch (err: any) {
    res.status(500).json({ success: false, errors: [{ message: err.message }] })
  }
})

// Create record
router.post('/zones/:zoneId/records', async (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params
    const resp = await fetch(`${CF_BASE}/zones/${zoneId}/dns_records`, {
      method: 'POST',
      headers: cfHeaders(),
      body: JSON.stringify(req.body),
    })
    const data = await resp.json()
    res.status(resp.status).json(data)
  } catch (err: any) {
    res.status(500).json({ success: false, errors: [{ message: err.message }] })
  }
})

// Update record
router.put('/zones/:zoneId/records/:recordId', async (req: Request, res: Response) => {
  try {
    const { zoneId, recordId } = req.params
    const resp = await fetch(`${CF_BASE}/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'PUT',
      headers: cfHeaders(),
      body: JSON.stringify(req.body),
    })
    const data = await resp.json()
    res.status(resp.status).json(data)
  } catch (err: any) {
    res.status(500).json({ success: false, errors: [{ message: err.message }] })
  }
})

// Delete record
router.delete('/zones/:zoneId/records/:recordId', async (req: Request, res: Response) => {
  try {
    const { zoneId, recordId } = req.params
    const resp = await fetch(`${CF_BASE}/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'DELETE',
      headers: cfHeaders(),
    })
    const data = await resp.json()
    res.status(resp.status).json(data)
  } catch (err: any) {
    res.status(500).json({ success: false, errors: [{ message: err.message }] })
  }
})

export { router as dnsRouter }
