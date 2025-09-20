import { Router } from "express";
import {
    createMeeting,
    getMeetings,
    getMeetingById,
    updateMeeting,
    cancelMeeting,
    startMeeting,
    endMeeting,
    getAvailableStaff,
    updateParticipantStatus
} from "../controllers/meeting.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

// All meeting routes require authentication
router.use(verifyJWT);

// Meeting CRUD operations
router.route("/").post(createMeeting).get(getMeetings);

router.route("/:meetingId")
    .get(getMeetingById)
    .patch(updateMeeting);

// Meeting actions
router.route("/:meetingId/start").post(startMeeting);
router.route("/:meetingId/end").post(endMeeting);
router.route("/:meetingId/cancel").post(cancelMeeting);

// Participant management
router.route("/:meetingId/respond").patch(updateParticipantStatus);

// Staff management (for managers)
router.route("/staff/available").get(getAvailableStaff);

export default router;
