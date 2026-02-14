import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { MongoClient, ObjectId } from 'mongodb'

dotenv.config({ quiet: true } as any)

const app = express()
const PORT = process.env.PORT || 7000

// URL-encode the password to handle special characters
const password = encodeURIComponent(process.env.MONGODB_PASSWORD || '')
const mongoUrl = `mongodb://seb:${password}@nexus-mongodb:27017/nexus?authSource=admin`
const client = new MongoClient(mongoUrl)

app.use(cors({ origin: ['https://nexus.sebhosting.com', 'http://localhost:3000'], credentials: true }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ service: 'cms-service', status: 'healthy' })
})

// ── PAGES ────────────────────────────────────────────────────

app.get('/pages', async (req, res) => {
  const db = client.db('nexus')
  const pages = await db.collection('pages')
    .find({ published: req.query.published === 'true' ? true : { $exists: true } })
    .sort({ created_at: -1 })
    .limit(100)
    .toArray()
  res.json(pages)
})

app.get('/pages/:id', async (req, res) => {
  const db = client.db('nexus')
  const page = await db.collection('pages').findOne({ _id: new ObjectId(req.params.id) })
  if (!page) return res.status(404).json({ error: 'Page not found' })
  res.json(page)
})

app.post('/pages', async (req, res) => {
  const { title, slug, content, published = false } = req.body
  const db = client.db('nexus')
  const result = await db.collection('pages').insertOne({
    title,
    slug,
    content,
    published,
    created_at: new Date(),
    updated_at: new Date(),
  })
  res.json({ id: result.insertedId })
})

app.put('/pages/:id', async (req, res) => {
  const { title, slug, content, published } = req.body
  const db = client.db('nexus')
  await db.collection('pages').updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { title, slug, content, published, updated_at: new Date() } }
  )
  res.json({ success: true })
})

app.delete('/pages/:id', async (req, res) => {
  const db = client.db('nexus')
  await db.collection('pages').deleteOne({ _id: new ObjectId(req.params.id) })
  res.json({ success: true })
})

// ── POSTS ────────────────────────────────────────────────────

app.get('/posts', async (req, res) => {
  const db = client.db('nexus')
  const posts = await db.collection('posts')
    .find({ published: req.query.published === 'true' ? true : { $exists: true } })
    .sort({ created_at: -1 })
    .limit(100)
    .toArray()
  res.json(posts)
})

app.post('/posts', async (req, res) => {
  const { title, slug, content, published = false, tags = [] } = req.body
  const db = client.db('nexus')
  const result = await db.collection('posts').insertOne({
    title,
    slug,
    content,
    published,
    tags,
    created_at: new Date(),
    updated_at: new Date(),
  })
  res.json({ id: result.insertedId })
})

client.connect().then(() => {
  console.log('✓ MongoDB connected')
  app.listen(PORT, () => console.log(`✓ CMS service on port ${PORT}`))
})
