import { Router, Request, Response } from 'express';
import { LLMFactory } from '../services/LLMFactory.js';
import { MCPClientSingleton } from '../services/MCPClientSingleton.js';
import { createValidationError, createSystemError } from '../utils/errorUtils.js';
import { logError, logInfo } from '../utils/logger.js';

const router = Router();

interface TextRequest {
  text: string;
}

interface TextResponse {
  response: string;
  toolsUsed: string[];
  error?: string;
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { text }: TextRequest = req.body;

    if (!text || typeof text !== 'string') {
      return createValidationError(res, 'Missing or invalid text field');
    }

    logInfo('Text Processing', `Processing query: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);

    // Get LLM provider and tools
    const llmProvider = LLMFactory.create();
    const mcpClient = await MCPClientSingleton.getInstance();
    const tools = await mcpClient.getAvailableTools();
    
    logInfo('Text Processing', `Using LLM: ${llmProvider.getModelName()}`);
    
    const result = await llmProvider.processText(text, tools);

    const response: TextResponse = {
      response: result.response,
      toolsUsed: result.toolsUsed
    };

    res.json(response);
  } catch (error) {
    logError('Text Processing', error);
    createSystemError(res, 'Failed to process text', error);
  }
});

export { router as textRouter }; 