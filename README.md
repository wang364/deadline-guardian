# Issue Reminder For Jira - Smart Jira Issue Reminder System

### 📋 Project Overview
Issue Reminder for Jira is a Jira smart-reminder application built on the Atlassian Forge platform. It monitors Jira issue status and due dates, then automatically sends reminder notifications when needed.

### 🔔 Core Modules
- **Smart Alerts**: automatic monitoring, early warning, multi-platform support  
- **Flexible Configuration**: check cycle, custom time, JQL query management  
- **Auto Site Discovery**: intelligent URL retrieval and secure storage  

### 🛠️ Technical Features
- **Frontend**: Atlassian UI Kit, responsive design, real-time interaction  
- **Backend**: Forge Functions, scheduled triggers, Jira API integration  
- **Integration**: Jira Cloud support, Feishu integration, multi-tenant ready  

### 💼 Use Cases
Project management, team collaboration, risk management and other real-world scenarios.

### 🔒 Security
Principle of least privilege, secure storage, access control.

## 🔐 权限使用分析
### 1. storage:app - Forge存储权限
使用场景： 存储应用配置数据

- 用户设置存储 ：保存用户的JQL查询规则、检查周期、检查时间等配置
- Webhook URL存储 ：保存飞书Webhook URL和Jira站点URL
- 调度配置 ：存储定时任务的周期和时间设置
具体代码位置：

- `index.js` 中的多个存储操作函数
### 2. read:jira-work - Jira工作项读取权限
使用场景： 读取Jira issue信息

- JQL查询执行 ：通过Jira REST API搜索符合条件的issue
- Issue信息获取 ：读取issue的key、summary、status、priority、assignee、duedate等字段
- 服务器信息获取 ：获取Jira站点的基础信息
具体代码位置：

- `executeJiraSearch` 函数
- `searchIssuesWithJql` 函数