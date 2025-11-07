# 项目范围文档

## 核心功能
- [ ] 监控指定Jira项目的due date
- [ ] 提前1天发送预警
- [ ] 支持Teams消息通知
- [ ] 基础配置界面


## 技术约束
- 使用Atlassian Forge平台
- 支持Jira Cloud
- 使用Forge存储
- 代码中仅使用英文，包含UI字符串和注释

# 技术选型文档

## 前端技术栈
- Forge UI Kit组件库

## 后端技术栈  
- Forge Functions
- Forge Storage

## 第三方集成
- Teams Incoming Webhook
- Jira REST API

## 开发工具
- Forge CLI
- npm/yarn
- Git版本控制

### 监控Jira due date: 
  - 依据: Jira REST API提供完整的issue搜索能力，支持due date字段查询

### 提前1天预警:
  - 依据: Forge Scheduled Functions支持定时任务，可每天运行检查

### Teams消息通知:
  - 依据: Teams Incoming Webhook是标准集成方式，文档完善

### 基础配置界面:
  - 依据: Forge UI Kit提供现成的表单组件