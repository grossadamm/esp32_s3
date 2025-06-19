import { Router } from 'express';
import { LLMFactory } from '../services/LLMFactory.js';
import { MCPClient } from '../services/MCPClient.js';
const router = Router();
const mcpClient = new MCPClient();
router.post('/', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || typeof text !== 'string') {
            return res.status(400).json({
                error: 'Missing or invalid text field'
            });
        }
        console.log(`Processing text query: ${text}`);
        // Get LLM provider and tools
        const llmProvider = LLMFactory.create();
        const tools = await mcpClient.getAvailableTools();
        console.log(`Using LLM: ${llmProvider.getModelName()}`);
        const result = await llmProvider.processText(text, tools);
        const response = {
            response: result.response,
            toolsUsed: result.toolsUsed
        };
        res.json(response);
    }
    catch (error) {
        console.error('Text endpoint error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            error: 'Failed to process text',
            message: errorMessage
        });
    }
});
export { router as textRouter };
//# sourceMappingURL=text.js.map