# Enotes - VS Code 笔记扩展

Enotes 是一个简单的 VS Code 笔记扩展，让您可以在任何项目中方便地管理和组织笔记。

## 功能特性

- 📝 创建和管理 Markdown 格式笔记
- 🏷️ 支持为笔记添加标签，方便分类和查找
- 🔄 实时自动保存笔记内容
- ✏️ 支持笔记重命名和标签编辑
- 🗑️ 轻松删除不需要的笔记
- 📂 自定义笔记存储位置
- 🎨 完美适配 VS Code 主题
- 📊 行号显示和当前行高亮
- ⌨️ 与 VS Code 一致的编辑体验

## 使用方法

### 1. 创建笔记
- 点击侧边栏的 "+" 按钮
- 输入笔记标题
- 开始编写您的笔记内容
- 笔记会自动保存

### 2. 管理标签
- 右键点击笔记或使用笔记项目上的标签图标
- 选择"修改标签"
- 输入标签（多个标签用逗号分隔）
- 标签会显示在笔记标题后面

### 3. 编辑和重命名
- 双击笔记直接打开编辑
- 使用笔记项目上的编辑图标重命名笔记
- 重命名后相关的标签信息会自动更新

### 4. 删除笔记
- 使用笔记项目上的删除图标
- 或右键点击笔记选择删除选项
- 删除操作会同时清理相关的标签信息

### 5. 刷新笔记列表
- 点击侧边栏的刷新按钮
- 会自动关闭所有打开的笔记面板
- 重新加载最新的笔记列表

## 编辑器特性

- 🎯 实时语法高亮
- 📏 行号显示与当前行高亮
- 🖍️ 自定义光标样式
- 🎨 完美适配 VS Code 主题颜色
- ⚡ 自动保存功能
- 📌 保持编辑位置
- 🔍 支持 Markdown 格式化

## 扩展设置

此扩展提供以下设置：

* `enotes.notesPath`: 设置笔记文件的保存路径
  - 默认保存在工作区的 `.vscode/notes` 目录下
  - 可以自定义为任意本地路径
* `enotes.openNoteRightNow`: 控制创建笔记后是否立即打开
  - 默认为 true，创建后立即打开笔记
  - 设置为 false 则仅创建不打开

## 注意事项

- 笔记以 Markdown 格式保存
- 标签信息保存在 `tags.json` 文件中
- 建议定期备份重要笔记
- 重命名或删除笔记时会自动处理相关标签
- 刷新操作会关闭所有打开的笔记面板

## 反馈
如果您在使用过程中遇到任何问题或建议，请随时提交 [Issue](https://github.com/ling-yuan/Enotes/issues) 或 Pull Request。
