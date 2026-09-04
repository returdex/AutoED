---
quick_id: 260904-w8b
type: quick
status: complete
completed: 2026-09-04
files:
  - share/macos-testing-guide.md
---

# Quick Task 260904-w8b：macOS 测试指南

## 结果

已创建供其他用户查看的 `share/macos-testing-guide.md`，内容包括：

- 当前 beta.31–beta.39 失效历史及“当前不可更新”硬门槛；
- 新候选出现前的自动验证要求；
- Phase 1 macOS 原生安装、A→B 更新、独立运行、恢复和 UI 检查步骤；
- Phase 2 02-14 的 projectless task、exact prompt、严格通过条件；
- 后续 live 检查边界、停止条件和 `02-14_UPDATE_RESULT` 脱敏模板。

## 验证

- 文件存在且可读；
- 关键硬门槛、safe code 和固定阻塞字段均存在；
- `git diff --check` 通过；
- 敏感路径、令牌样式和私密资料扫描未命中；
- 未执行安装、更新、登录、OS 授权、重启、学校访问或远程发布。

## 边界

文档不包含任何旧候选下载链接、旧 hash、账户信息、Profile/凭据、私有路径、原始日志或课程内容；不会把 synthetic、发布或匿名下载结果写成真实 live 通过。
