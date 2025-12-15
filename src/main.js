const vscode = require('vscode');
const { NotesProvider } = require('./providers/NotesProvider');
const { NotesViewProvider } = require('./notesView');
const { registerCommands } = require('./commands');

/**
 * 扩展激活函数
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
    // 创建笔记数据提供者
    const notesProvider = new NotesProvider(context);

    // 创建并注册Webview视图提供者
    const viewProvider = new NotesViewProvider(context, notesProvider);
    notesProvider.viewProvider = viewProvider;

    // 等待初始化完成
    await notesProvider.initialize();

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('enotesView', viewProvider)
    );

    // 注册所有命令
    registerCommands(context, notesProvider, viewProvider);

    // 初始化时触发一次刷新
    vscode.commands.executeCommand('enotes.refreshNotes');
}

/**
 * 扩展停用函数
 */
function deactivate() { }

module.exports = {
    activate,
    deactivate
};
