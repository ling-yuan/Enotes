const vscode = require('vscode');
const { getNotesPath } = require('../utils/config');

/**
 * 标签管理器
 */
class TagManager {
    constructor() {
        this.tags = new Map();
    }

    /**
     * 初始化标签
     * @returns {Promise<void>}
     */
    async initializeTags() {
        const notesPath = await getNotesPath();
        const tagsFileUri = vscode.Uri.file(`${notesPath}/tags.json`);
        try {
            const fileContent = await vscode.workspace.fs.readFile(tagsFileUri);
            let tagsData = JSON.parse(new TextDecoder().decode(fileContent));

            if (tagsData && typeof tagsData === 'object') {
                this.tags = new Map(Object.entries(tagsData));
            } else {
                this.tags = new Map();
                await this.saveTags();
            }
        }
        catch (error) {
            // 如果文件不存在，创建一个空的标签文件
            this.tags = new Map();
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(tagsFileUri, encoder.encode('{}'));
        }
    }

    /**
     * 保存标签
     * @returns {Promise<void>}
     */
    async saveTags() {
        const notesPath = await getNotesPath();
        const tagsFile = vscode.Uri.file(`${notesPath}/tags.json`);

        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(
            tagsFile,
            encoder.encode(JSON.stringify(Object.fromEntries(this.tags), null, 2))
        );
    }

    /**
     * 更改标签
     * @param {string} key 键
     * @param {any} value 值
     * @returns {Promise<void>}
     */
    async changeTag(key, value) {
        if (!Array.isArray(value)) {
            value = [value];
        }
        this.tags.set(key, value);
        await this.saveTags();
    }

    /**
     * 重命名标签
     * @param {string} oldKey 旧键
     * @param {string} newKey 新键
     * @returns {Promise<void>}
     */
    async renameTag(oldKey, newKey) {
        let v = this.tags.get(oldKey);
        if (v) {
            this.tags.set(newKey, v);
            this.tags.delete(oldKey);
        }
        else {
            this.tags.set(newKey, []);
        }
        await this.saveTags();
    }

    /**
     * 删除标签
     * @param {string} key 键
     * @returns {Promise<void>}
     */
    async deleteTag(key) {
        this.tags.delete(key);
        await this.saveTags();
    }

    /**
     * 获取标签
     * @param {string} title 标题
     * @returns {string[]} 标签数组
     */
    getTags(title) {
        return this.tags.get(title) || [];
    }
}

module.exports = { TagManager };
