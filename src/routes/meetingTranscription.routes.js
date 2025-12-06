// src/routes/meetingTranscription.routes.js
import express from 'express';
import { 
  processTranscription, 
  getActionItems,
  updateActionItemStatus
} from '../controllers/meetingTranscription.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protected routes (require authentication)
router.use(protect);

router.post('/meetings/:meetingId/process-transcription', processTranscription);
router.get('/users/:userId/action-items', getActionItems);
router.patch('/meetings/:meetingId/action-items/:actionItemId', updateActionItemStatus);

export default router;