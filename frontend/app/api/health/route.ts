export async function GET() {
  return Response.json({ 
    service: 'frontend', 
    status: 'healthy',
    timestamp: new Date().toISOString()
  })
}
