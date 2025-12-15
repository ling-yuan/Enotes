const vscode = require('vscode');

/**
 * 用于获取插件配置
 * @param {string} param 配置参数名
 * @returns {Promise<any>} 插件配置
 */
async function getConfig(param) {
    return vscode.workspace.getConfiguration('enotes').get(param);
}

/**
 * 用于获取笔记保存路径
 * @returns {Promise<string>} 笔记保存路径
 */
async function getNotesPath() {
    let notesPath = await getConfig('notesPath');

    if (!notesPath) {
        const workspaceFolder = vscode.workspace.workspaceFolders;
        if (!workspaceFolder) {
            throw new Error('请先打开一个工作区! ');
        }
        notesPath = vscode.Uri.joinPath(workspaceFolder[0].uri, '.vscode', 'notes').fsPath;
    }

    // 确保目录存在
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(notesPath));
    return notesPath;
}

/**
 * 用于获取笔记文件的 Uri
 * @param {string} noteTitle 笔记标题
 * @returns {Promise<vscode.Uri>} 笔记文件的 Uri
 */
async function getNoteUri(noteTitle) {
    const title = noteTitle.split('[')[0].trim();
    const notesPath = await getNotesPath();
    return vscode.Uri.file(`${notesPath}/${title}.md`);
}

module.exports = {
    getConfig,
    getNotesPath,
    getNoteUri
};
