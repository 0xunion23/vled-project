import { Router } from 'express';
import { getSuggestions } from '../controllers/suggestionController.js';

const router = Router();

router.get('/', getSuggestions);

export default router;
