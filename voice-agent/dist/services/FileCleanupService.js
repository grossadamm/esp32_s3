import fs from 'fs';
import path from 'path';
export class FileCleanupService {
    static cleanupUploadsDirectory() {
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            return;
        }
        try {
            const files = fs.readdirSync(uploadsDir);
            for (const file of files) {
                const filePath = path.join(uploadsDir, file);
                fs.unlinkSync(filePath);
            }
            console.log(`Cleaned up ${files.length} files from uploads directory`);
        }
        catch (error) {
            console.error('Failed to cleanup uploads directory:', error);
        }
    }
}
//# sourceMappingURL=FileCleanupService.js.map