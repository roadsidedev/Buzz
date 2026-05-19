/**
 * Seed Platform Agents
 * 
 * Creates platform-native agents (radio-runner hosts/co-hosts, video anchors)
 * that are required for the discovery and profile features to work.
 * 
 * These agents are created with role='bot' and claim_status='claimed' so they
 * bypass the human claim flow and are immediately usable.
 * 
 * Usage:
 *   npx tsx scripts/seed-platform-agents.ts
 */

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// ── Configuration ─────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321'
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'supabase-key'
const DATABASE_URL = process.env.DATABASE_URL

// Platform agent definitions
const PLATFORM_AGENTS = [
  {
    id: 'radio-alex-01',
    username: 'radio_alex_01',
    name: 'Alex -- RadioHost',
    description: 'Your charismatic radio host. Keeps the conversation flowing with energy and wit. Specializes in debate moderation and audience engagement.',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=radio_alex',
    role: 'bot',
    claim_status: 'claimed',
    verification_status: 'verified',
    specialization: 'radio-host,debate-moderator,engagement',
    metadata: {
      type: 'radio-runner',
      role: 'host',
      voice: 'alex',
      personality: 'charismatic,energetic,witty',
    },
  },
  {
    id: 'radio-mira-01',
    username: 'radio_mira_01',
    name: 'Mira -- RadioCohost',
    description: 'The thoughtful co-host who brings depth and perspective. Excels at asking probing questions and connecting ideas across topics.',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=radio_mira',
    role: 'bot',
    claim_status: 'claimed',
    verification_status: 'verified',
    specialization: 'radio-cohost,analyst,questioner',
    metadata: {
      type: 'radio-runner',
      role: 'cohost',
      voice: 'mira',
      personality: 'thoughtful,analytical,curious',
    },
  },
  {
    id: 'video-anchor-01',
    username: 'video_anchor_01',
    name: 'News Anchor',
    description: 'Professional video livestream anchor. Delivers news and commentary with clarity and authority. Handles live Q&A and audience interaction.',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=video_anchor',
    role: 'bot',
    claim_status: 'claimed',
    verification_status: 'verified',
    specialization: 'video-anchor,news,commentary',
    metadata: {
      type: 'video-livestream',
      role: 'anchor',
      voice: 'anchor',
      personality: 'professional,authoritative,clear',
    },
  },
]

// ── Helper Functions ──────────────────────────────────────────────────────────

function generateApiKey(): string {
  return `beely_${crypto.randomBytes(24).toString('hex')}`
}

function generateJamKeys(): { publicKey: string; privateKey: string } {
  // Generate Ed25519 key pair for Jam identity
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  return {
    publicKey: publicKey.replace(/-----.*?-----/g, '').replace(/\s/g, ''),
    privateKey: privateKey.replace(/-----.*?-----/g, '').replace(/\s/g, ''),
  }
}

// ── Main Seed Function ────────────────────────────────────────────────────────

async function seedPlatformAgents() {
  console.log('🌱 Seeding platform agents...\n')

  // Use direct database connection if available, otherwise use Supabase
  if (DATABASE_URL) {
    await seedWithDirectDB()
  } else {
    await seedWithSupabase()
  }

  console.log('\n✅ Platform agents seeded successfully!')
  console.log('\nAgent IDs:')
  PLATFORM_AGENTS.forEach((agent) => {
    console.log(`  - ${agent.id} (${agent.username})`)
  })
}

async function seedWithDirectDB() {
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: DATABASE_URL })

  try {
    for (const agent of PLATFORM_AGENTS) {
      const { publicKey, privateKey } = generateJamKeys()
      const apiKey = generateApiKey()

      // Check if agent already exists
      const existing = await pool.query(
        'SELECT id FROM agent WHERE id = $1 OR username = $2',
        [agent.id, agent.username]
      )

      if (existing.rows.length > 0) {
        console.log(`⏭️  Agent ${agent.username} already exists, updating...`)
        
        await pool.query(
          `UPDATE agent SET 
            name = $1, 
            description = $2, 
            avatar_url = $3, 
            role = $4, 
            claim_status = $5, 
            verification_status = $6,
            specialization_tags = $7,
            metadata = $8,
            updated_at = NOW()
          WHERE id = $9`,
          [
            agent.name,
            agent.description,
            agent.avatar,
            agent.role,
            agent.claim_status,
            agent.verification_status,
            agent.specialization.split(','),
            JSON.stringify(agent.metadata),
            existing.rows[0].id,
          ]
        )
      } else {
        console.log(` Creating agent ${agent.username}...`)

        await pool.query(
          `INSERT INTO agent (
            id, username, name, description, avatar_url, 
            role, claim_status, verification_status,
            specialization_tags, metadata,
            api_key, jam_public_key, jam_private_key_encrypted,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())`,
          [
            agent.id,
            agent.username,
            agent.name,
            agent.description,
            agent.avatar,
            agent.role,
            agent.claim_status,
            agent.verification_status,
            agent.specialization.split(','),
            JSON.stringify(agent.metadata),
            apiKey,
            publicKey,
            privateKey, // In production, this should be encrypted
          ]
        )
      }
    }
  } finally {
    await pool.end()
  }
}

async function seedWithSupabase() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  for (const agent of PLATFORM_AGENTS) {
    const { publicKey, privateKey } = generateJamKeys()
    const apiKey = generateApiKey()

    // Check if agent already exists
    const { data: existing } = await supabase
      .from('agent')
      .select('id')
      .eq('username', agent.username)
      .single()

    if (existing) {
      console.log(`⏭️  Agent ${agent.username} already exists, updating...`)
      
      await supabase
        .from('agent')
        .update({
          name: agent.name,
          description: agent.description,
          avatar_url: agent.avatar,
          role: agent.role,
          claim_status: agent.claim_status,
          verification_status: agent.verification_status,
          specialization_tags: agent.specialization.split(','),
          metadata: agent.metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      console.log(`➕ Creating agent ${agent.username}...`)

      await supabase.from('agent').insert({
        id: agent.id,
        username: agent.username,
        name: agent.name,
        description: agent.description,
        avatar_url: agent.avatar,
        role: agent.role,
        claim_status: agent.claim_status,
        verification_status: agent.verification_status,
        specialization_tags: agent.specialization.split(','),
        metadata: agent.metadata,
        api_key: apiKey,
        jam_public_key: publicKey,
        jam_private_key_encrypted: privateKey,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }
  }
}

// ─ Run ───────────────────────────────────────────────────────────────────────

seedPlatformAgents().catch((err) => {
  console.error('❌ Failed to seed platform agents:', err)
  process.exit(1)
})
