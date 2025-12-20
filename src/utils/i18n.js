// 多语言配置文件
const translations = {
  en: {
    // 通用术语
    appTitle: "Jira Issue Reminder",
    settings: "Settings",
    save: "Save",
    cancel: "Cancel",
    success: "Success",
    error: "Error",
    optional: "optional",
    
    // 通知消息
    reminderTitle: "🔔 Jira Issue Reminder",
    issuesRequireAttention: "You have {count} Jira issue(s) that require attention:",
    issuesUpcoming: "You have {count} Jira issue(s) with approaching due dates:",
    
    // 问题字段
    unassigned: "Unassigned",
    notSet: "Not set",
    unknown: "Unknown",
    dueDate: "Due",
    assignee: "Assignee",
    priority: "Priority",
    status: "Status",
    
    // 时间描述
    overdueBy: "Overdue by {days} day(s)",
    dueToday: "Due today",
    dueInDays: "Due in {days} day(s)",
    
    // Webhook 配置
    webhookUrl: "Webhook URL",
    configureWebhook: "Configure your {platform} webhook URL for notifications",
    
    // 平台名称
    feishu: "Feishu",
    slack: "Slack",
    wechatwork: "WeChat Work",
    teams: "Microsoft Teams",
    
    // 调度设置
    scheduleSettings: "Schedule Settings",
    schedulePeriod: "Schedule Period",
    scheduleTime: "Schedule Time (24-hour format)",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    
    // 成功消息
    settingsSaved: "Settings saved successfully",
    settingsFailed: "Failed to save settings",
    webhookSaved: "Webhook URL saved successfully",
    webhookFailed: "Failed to save webhook URL"
  },
  
  zh: {
    // 通用术语
    appTitle: "Jira 问题提醒",
    settings: "设置",
    save: "保存",
    cancel: "取消",
    success: "成功",
    error: "错误",
    optional: "可选",
    
    // 通知消息
    reminderTitle: "🔔 Jira 问题提醒",
    issuesRequireAttention: "您有 {count} 个 Jira 问题需要关注：",
    issuesUpcoming: "您有 {count} 个 Jira 问题即将到期：",
    
    // 问题字段
    unassigned: "未分配",
    notSet: "未设置",
    unknown: "未知",
    dueDate: "截止日期",
    assignee: "负责人",
    priority: "优先级",
    status: "状态",
    
    // 时间描述
    overdueBy: "已逾期 {days} 天",
    dueToday: "今天到期",
    dueInDays: "{days} 天后到期",
    
    // Webhook 配置
    webhookUrl: "Webhook URL",
    configureWebhook: "配置您的 {platform} webhook URL 用于接收通知",
    
    // 平台名称
    feishu: "飞书",
    slack: "Slack",
    wechatwork: "企业微信",
    teams: "Microsoft Teams",
    
    // 调度设置
    scheduleSettings: "调度设置",
    schedulePeriod: "调度周期",
    scheduleTime: "调度时间 (24小时制)",
    daily: "每日",
    weekly: "每周",
    monthly: "每月",
    
    // 成功消息
    settingsSaved: "设置保存成功",
    settingsFailed: "设置保存失败",
    webhookSaved: "Webhook URL 保存成功",
    webhookFailed: "Webhook URL 保存失败"
  }
};

// 语言检测函数
const detectLanguage = async (context = null) => {
  // 如果提供了上下文，从中检测语言并保存到storage
  if (context && context.locale) {
    const jiraLocale = context.locale;
    // 简化为只支持中英文，根据Jira的语言设置自动检测
    const detectedLanguage = jiraLocale.startsWith('zh') ? 'zh' : 'en';
    
    // 保存到storage供后台使用
    try {
      const storage = require('@forge/api').storage;
      await storage.set('userLanguage', detectedLanguage);
    } catch (error) {
      console.log('Error saving language to storage:', error.message);
    }
    
    return detectedLanguage;
  }
  
  // 在后台解析器中，从storage读取保存的语言设置
  try {
    const storage = require('@forge/api').storage;
    const savedLanguage = await storage.get('userLanguage');
    return savedLanguage || 'en';
  } catch (error) {
    console.log('Error reading language from storage:', error.message);
    return 'en';
  }
};

// 翻译函数
const t = async (key, params = {}, lang = null) => {
  const language = lang || await detectLanguage();
  let translation = translations[language]?.[key] || translations['en'][key] || key;
  
  // 替换参数
  if (params && Object.keys(params).length > 0) {
    Object.keys(params).forEach(param => {
      translation = translation.replace(`{${param}}`, params[param]);
    });
  }
  
  return translation;
};

// 格式化日期描述
const formatDueDate = async (dueDate, lang = null) => {
  if (!dueDate) return '';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return await t('overdueBy', { days: Math.abs(diffDays) }, lang);
  } else if (diffDays === 0) {
    return await t('dueToday', {}, lang);
  } else {
    return await t('dueInDays', { days: diffDays }, lang);
  }
};

module.exports = {
  translations,
  detectLanguage,
  t,
  formatDueDate
};