/**
 * Buzz Routes for Pantry
 *
 * Custom endpoints for Buzz orchestration integration.
 * Enables turn-taking signaling, audio lifecycle events, and room coordination.
 */

const express = require('express');
const router = express.Router();

// Redis client (shared with Buzz)
let redisClient = null;

/**
 * Initialize routes with Redis client
 */
function initBeelyRoutes(redis) {
  redisClient = redis;
  return router;
}

/**
 * Broadcast event to room via WebSocket
 */
function broadcastToRoom(roomId, topic, type, payload) {
  // This will be called by the pantry WebSocket server
  // to broadcast to all connected peers in the room
  if (global.broadcastToRoom) {
    global.broadcastToRoom(roomId, topic, type, payload);
  }
}

/**
 * Publish event to Redis for Buzz backend
 */
async function publishToRedis(channel, event) {
  if (redisClient) {
    await redisClient.publish(channel, JSON.stringify(event));
  }
}

/**
 * POST /api/v1/Buzz/rooms/:id/turn
 *
 * Signal turn-taking event for orchestrator coordination.
 * Used by Buzz orchestrator to indicate which agent should speak.
 */
router.post('/rooms/:id/turn', async (req, res) => {
  const {id: roomId} = req.params;
  const {agentId, duration, messageId} = req.body;

  if (!agentId) {
    return res.status(400).json({error: 'agentId is required'});
  }

  try {
    // Broadcast turn-started to room
    broadcastToRoom(roomId, 'Buzz', 'turn-started', {
      agentId,
      duration,
      messageId,
      timestamp: Date.now(),
    });

    // Publish to Redis for Buzz backend
    await publishToRedis('buzz:room:events', {
      type: 'turn_started',
      roomId,
      agentId,
      data: {duration, messageId},
      timestamp: Date.now(),
    });

    res.json({success: true, agentId, duration});
  } catch (error) {
    console.error('Error handling turn event:', error);
    res.status(500).json({error: 'Failed to process turn event'});
  }
});

/**
 * POST /api/v1/Buzz/rooms/:id/turn/end
 *
 * Signal end of turn for current speaker.
 */
router.post('/rooms/:id/turn/end', async (req, res) => {
  const {id: roomId} = req.params;
  const {agentId} = req.body;

  try {
    broadcastToRoom(roomId, 'Buzz', 'turn-ended', {
      agentId,
      timestamp: Date.now(),
    });

    await publishToRedis('buzz:room:events', {
      type: 'turn_ended',
      roomId,
      agentId,
      timestamp: Date.now(),
    });

    res.json({success: true});
  } catch (error) {
    console.error('Error ending turn:', error);
    res.status(500).json({error: 'Failed to end turn'});
  }
});

/**
 * POST /api/v1/Buzz/rooms/:id/audio/start
 *
 * Signal audio stream start from AI agent.
 */
router.post('/rooms/:id/audio/start', async (req, res) => {
  const {id: roomId} = req.params;
  const {agentId, messageId, duration} = req.body;

  try {
    broadcastToRoom(roomId, 'Buzz', 'audio-started', {
      agentId,
      messageId,
      duration,
      timestamp: Date.now(),
    });

    await publishToRedis('jam:events', {
      type: 'audio_started',
      roomId,
      agentId,
      data: {messageId, duration},
      timestamp: Date.now(),
    });

    res.json({success: true, messageId});
  } catch (error) {
    console.error('Error starting audio:', error);
    res.status(500).json({error: 'Failed to start audio'});
  }
});

/**
 * POST /api/v1/Buzz/rooms/:id/audio/end
 *
 * Signal audio stream end.
 */
router.post('/rooms/:id/audio/end', async (req, res) => {
  const {id: roomId} = req.params;
  const {agentId, messageId} = req.body;

  try {
    broadcastToRoom(roomId, 'Buzz', 'audio-ended', {
      agentId,
      messageId,
      timestamp: Date.now(),
    });

    await publishToRedis('jam:events', {
      type: 'audio_ended',
      roomId,
      agentId,
      data: {messageId},
      timestamp: Date.now(),
    });

    res.json({success: true});
  } catch (error) {
    console.error('Error ending audio:', error);
    res.status(500).json({error: 'Failed to end audio'});
  }
});

/**
 * POST /api/v1/Buzz/rooms/:id/score
 *
 * Receive message score from orchestrator.
 * Broadcasts score to room for real-time feedback.
 */
router.post('/rooms/:id/score', async (req, res) => {
  const {id: roomId} = req.params;
  const {messageId, score, dimensions} = req.body;

  try {
    broadcastToRoom(roomId, 'Buzz', 'message-scored', {
      messageId,
      score,
      dimensions,
      timestamp: Date.now(),
    });

    res.json({success: true});
  } catch (error) {
    console.error('Error publishing score:', error);
    res.status(500).json({error: 'Failed to publish score'});
  }
});

/**
 * POST /api/v1/Buzz/rooms/:id/objective/update
 *
 * Update room objective progress.
 */
router.post('/rooms/:id/objective/update', async (req, res) => {
  const {id: roomId} = req.params;
  const {progress, status, message} = req.body;

  try {
    broadcastToRoom(roomId, 'Buzz', 'objective-updated', {
      progress,
      status,
      message,
      timestamp: Date.now(),
    });

    res.json({success: true});
  } catch (error) {
    console.error('Error updating objective:', error);
    res.status(500).json({error: 'Failed to update objective'});
  }
});

/**
 * POST /api/v1/Buzz/rooms/:id/closing
 *
 * Signal room is about to close.
 * Gives clients time to finish operations.
 */
router.post('/rooms/:id/closing', async (req, res) => {
  const {id: roomId} = req.params;
  const {reason, delay} = req.body;

  try {
    broadcastToRoom(roomId, 'Buzz', 'room-closing', {
      reason,
      delay: delay || 5000,
      timestamp: Date.now(),
    });

    await publishToRedis('jam:events', {
      type: 'room_closing',
      roomId,
      data: {reason, delay},
      timestamp: Date.now(),
    });

    res.json({success: true});
  } catch (error) {
    console.error('Error signaling room closing:', error);
    res.status(500).json({error: 'Failed to signal closing'});
  }
});

module.exports = initBeelyRoutes;
