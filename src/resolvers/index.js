import Resolver from '@forge/resolver';
import api, { storage, route } from '@forge/api';

const resolver = new Resolver();

// Log utility function
const log = (message, data) => {
  console.log(`[${new Date().toISOString()}] ${message}:`, JSON.stringify(data, null, 2));
};

// 定义选项数组，与前端保持一致
const periodOptions = [
  { label: 'Daily', value: 'Daily' },
  { label: 'Monday', value: 'Monday' },
  { label: 'Tuesday', value: 'Tuesday' },
  { label: 'Wednesday', value: 'Wednesday' },
  { label: 'Thursday', value: 'Thursday' },
  { label: 'Friday', value: 'Friday' },
  { label: 'Saturday', value: 'Saturday' },
  { label: 'Sunday', value: 'Sunday' }
];

resolver.define('saveUserSettings', async ({ payload }) => {
  log('Saving user settings', { 
    payloadType: typeof payload,
    payloadKeys: payload ? Object.keys(payload) : []
  });
  
  // 安全验证：验证设置结构
  const { settings = [], schedulePeriod = { label: 'Daily', value: 'Daily' }, gmtScheduleTime = '17:00' } = payload;
  
  if (!securityUtils.validateSettingsStructure(settings)) {
    log('Invalid settings structure detected', { settings });
    return { success: false, error: 'Invalid settings structure' };
  }
  
  // 安全清理：清理设置数据
  const sanitizedSettings = settings.map(setting => ({
    jql: setting.jql ? securityUtils.sanitizeInput(setting.jql) : ''
  }));
  
  log('Extracted and sanitized settings', { sanitizedSettings, schedulePeriod, gmtScheduleTime });

  // Helper to extract and validate schedulePeriod as Option object
  const extractSchedulePeriod = (val) => {
    if (!val) return { label: 'Daily', value: 'Daily' };
    
    // 如果已经是有效的 Option 对象
    if (typeof val === 'object' && val.label && val.value) {
      // 验证 value 是否在允许的选项中
      const isValidOption = periodOptions.some(option => option.value === val.value);
      return isValidOption ? val : { label: 'Daily', value: 'Daily' };
    }
    
    // 如果是字符串，尝试转换为 Option 对象
    if (typeof val === 'string') {
      const matchedOption = periodOptions.find(option => option.value === val.trim());
      return matchedOption || { label: 'Daily', value: 'Daily' };
    }
    
    // 如果是 DOM event 对象
    if (val.target && typeof val.target.value !== 'undefined') {
      const matchedOption = periodOptions.find(option => option.value === String(val.target.value).trim());
      return matchedOption || { label: 'Daily', value: 'Daily' };
    }
    
    // 未知格式，返回默认值
    return { label: 'Daily', value: 'Daily' };
  };

  // Helper to extract scheduleTime as string
  const extractScheduleTime = (val) => {
    if (!val) return '17:00';
    
    // 如果是 DOM event 对象
    if (val.target && typeof val.target.value !== 'undefined') {
      return String(val.target.value);
    }
    
    // 如果是对象但有 value 属性
    if (typeof val === 'object' && typeof val.value !== 'undefined') {
      return String(val.value);
    }
    
    return String(val);
  };

  const safeSchedulePeriod = extractSchedulePeriod(schedulePeriod);
  const safeScheduleTime = extractScheduleTime(gmtScheduleTime);

  // 改进的时间格式验证，支持多种格式：H:M, HH:M, H:MM, HH:MM
  const isValidTimeFormat = (time) => {
    if (!time || typeof time !== 'string') return false;
    const timeRegex = /^(\d{1,2}):(\d{1,2})$/;
    const trimmedTime = time.trim();
    const match = trimmedTime.match(timeRegex);
    
    if (!match) return false;
    
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  };
  
  const validatedScheduleTime = isValidTimeFormat(safeScheduleTime) ? safeScheduleTime : '17:00';

  // Store the whole settings array under a single key for simplicity and retrieval
  await storage.set('settings', sanitizedSettings);

  // Store schedule settings separately (always as strings)
  await storage.set('schedulePeriod', safeSchedulePeriod);
  await storage.set('scheduleTime', validatedScheduleTime);

  log('Saved user settings', { sanitizedSettings });
  log('Stored schedule period', {safeSchedulePeriod});
  log('Stored schedule time', {validatedScheduleTime});
  return { success: true };
});

// Get all settings
resolver.define('getSettings', async () => {
  const stored = await storage.get('settings');
  const settings = stored || [];
  log('User settings fetched', { 
    hasSettings: !!settings,
    settingsLength: settings.length,
    settingsType: typeof settings
  });
  return { settings };
});

// Get schedule period as Option object
resolver.define('getschedulePeriod', async () => {
  let schedulePeriod = await storage.get('schedulePeriod');
  
  log('Raw schedule period from storage', { 
    type: typeof schedulePeriod,
    value: schedulePeriod,
    isNull: schedulePeriod === null,
    isUndefined: schedulePeriod === undefined
  });
  
  // 如果存储的是字符串，转换为 Option 对象
  if (typeof schedulePeriod === 'string') {
    log('Converting string schedule period to Option object', { stringValue: schedulePeriod });
    const matchedOption = periodOptions.find(option => option.value === schedulePeriod);
    if (matchedOption) {
      schedulePeriod = matchedOption;
      await storage.set('schedulePeriod', schedulePeriod);
      log('Converted string to Option object', schedulePeriod);
    } else {
      schedulePeriod = { label: 'Daily', value: 'Daily' };
      await storage.set('schedulePeriod', schedulePeriod);
      log('Set default Option object', schedulePeriod);
    }
  }
  // 如果存储的是无效对象，修复它
  else if (typeof schedulePeriod === 'object' && schedulePeriod !== null) {
    log('Processing object schedule period', { objectKeys: Object.keys(schedulePeriod) });
    // 检查是否具有正确的格式
    if (!schedulePeriod.label || !schedulePeriod.value) {
      const matchedOption = periodOptions.find(option => 
        option.value === (schedulePeriod.value || schedulePeriod.target?.value || 'Daily')
      );
      schedulePeriod = matchedOption || { label: 'Daily', value: 'Daily' };
      await storage.set('schedulePeriod', schedulePeriod);
      log('Fixed invalid Option object', schedulePeriod);
    }
    // 验证 value 是否在允许的选项中
    else if (!periodOptions.some(option => option.value === schedulePeriod.value)) {
      schedulePeriod = { label: 'Daily', value: 'Daily' };
      await storage.set('schedulePeriod', schedulePeriod);
      log('Fixed invalid Option value', schedulePeriod);
    }
  }
  // 如果没有存储的值或值为 null/undefined
  else {
    log('No valid schedule period found, setting default');
    schedulePeriod = { label: 'Daily', value: 'Daily' };
    await storage.set('schedulePeriod', schedulePeriod);
    log('Set initial default Option object', schedulePeriod);
  }

  log('Final schedulePeriod result', schedulePeriod);
  return { schedulePeriod };
});

resolver.define('getscheduleTime', async () => {
  log('Fetching schedule time from storage');
  let scheduleTime = await storage.get('scheduleTime');
  
  log('Raw schedule time from storage', { 
    type: typeof scheduleTime,
    value: scheduleTime,
    isNull: scheduleTime === null,
    isUndefined: scheduleTime === undefined
  });
  
  // If scheduleTime is an object, try to extract a primitive value, otherwise null
  if (typeof scheduleTime === 'object' && scheduleTime !== null) {
    log('Processing object schedule time', { objectKeys: Object.keys(scheduleTime) });
    if (scheduleTime.target && typeof scheduleTime.target.value !== 'undefined') {
      scheduleTime = String(scheduleTime.target.value);
      log('Extracted time from target.value', { extractedTime: scheduleTime });
    } else if (typeof scheduleTime.value !== 'undefined') {
      scheduleTime = String(scheduleTime.value);
      log('Extracted time from value property', { extractedTime: scheduleTime });
    } else {
      scheduleTime = null;
      log('No valid time found in object, setting to null');
    }
  }

  // 改进的时间格式验证，支持多种格式：H:M, HH:M, H:MM, HH:MM
  const isValidTimeFormat = (time) => {
    if (!time || typeof time !== 'string') return false;
    const timeRegex = /^(\d{1,2}):(\d{1,2})$/;
    const trimmedTime = time.trim();
    const match = trimmedTime.match(timeRegex);
    
    if (!match) return false;
    
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  };
  
  log('Validating schedule time format', { scheduleTime, isValid: isValidTimeFormat(scheduleTime) });
  
  if (!scheduleTime || typeof scheduleTime !== 'string' || !isValidTimeFormat(scheduleTime)) {
    const defaultTime = '17:00';
    log('Invalid or missing schedule time, setting default', { defaultTime });
    await storage.set('scheduleTime', defaultTime);
    log('Normalized scheduleTime to default', defaultTime);
    return { scheduleTime: defaultTime };
  }

  log('Final scheduleTime result', { scheduleTime });
  return { scheduleTime };
});

// Check and trigger alerts - 用于scheduledTrigger的函数
// 执行Jira搜索的通用函数
const executeJiraSearch = async (jql) => {
  try {
    log('Making Jira API POST request for enhanced JQL search', { 
      endpoint: '/rest/api/3/search/jql', 
      jql, 
      maxResults: 50,
      fields: 'key,summary,duedate,assignee,status,priority,updated'
    });
    
    // 使用POST方法进行增强JQL搜索，支持更复杂的查询
    const requestBody = {
      jql: jql,
      maxResults: 50,
      fields: ['key', 'summary', 'duedate', 'assignee', 'status', 'priority', 'updated'],
    };
    
    log('Jira API request body', requestBody);
    
    const jiraApi = api.asApp();
    const response = await jiraApi.requestJira(route`/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    // 获取完整的response body文本用于调试
    const responseBodyText = await response.text();
    log('Jira API response body (raw text):', responseBodyText);
    
    // 创建新的response对象用于JSON解析
    const responseClone = new Response(responseBodyText, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
        
    if (!response.ok) {
      log('Jira API error response', { status: response.status, responseBodyText });
      throw new Error(`Jira API request failed: ${response.status} ${response.statusText} - ${responseBodyText}`);
    }
    
    const data = await responseClone.json();
    log('Enhanced JQL search data parsed successfully', { 
      totalIssues: data.total || data.issues?.length || 0,
      maxResults: data.maxResults || data.issues?.length || 0,
      issuesCount: data.issues ? data.issues.length : 0
    });

    // 获取Jira站点的完整URL - 首先尝试从storage中读取用户保存的URL
    let baseUrl;
    try {
      // 首先尝试从storage中读取用户保存的Jira站点URL
      const storedJiraSiteUrl = await storage.get('jiraSiteUrl');
      if (storedJiraSiteUrl) {
        // 从完整的URL中提取域名部分（移除https://前缀）
        const url = new URL(storedJiraSiteUrl);
        baseUrl = url.hostname;
        log('Using Jira site URL from storage', { 
          storedUrl: storedJiraSiteUrl,
          extractedBaseUrl: baseUrl 
        });
      } else {
        // 如果storage中没有保存的URL，使用serverInfo API
        log('No Jira site URL found in storage, using serverInfo API');
        const serverInfoResponse = await jiraApi.requestJira('/rest/api/3/serverInfo', {
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (serverInfoResponse.ok) {
          const serverInfo = await serverInfoResponse.json();
          baseUrl = serverInfo.baseUrl;
          log('Successfully retrieved Jira server info', { baseUrl });
        } else {
          log('Failed to get server info, using alternative approach', { 
            status: serverInfoResponse.status 
          });
          // 如果无法获取serverInfo，使用占位符URL
          baseUrl = 'jira-instance.example.com'; // 占位符，需要用户配置
        }
      }
    } catch (error) {
      log('Error getting Jira site URL, using alternative approach', { 
        error: error.message 
      });
      // 如果无法获取URL，使用占位符URL
      baseUrl = 'jira-instance.example.com'; // 占位符，需要用户配置
    }
    
    const issues = data.issues.map(issue => {
      // 构建issue链接 - 使用Jira站点的完整URL
      const issueLink = `https://${baseUrl}/browse/${issue.key}`;
      
      const issueData = {
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status?.name,
        priority: issue.fields.priority?.name,
        assignee: issue.fields.assignee?.displayName,
        dueDate: issue.fields.duedate,
        updated: issue.fields.updated,
        link: issueLink, // 添加issue链接
        fields: {}
      };
      
      // 包含请求的所有字段
      ['key', 'summary', 'duedate', 'assignee', 'status', 'priority', 'updated'].forEach(field => {
        if (issue.fields[field] !== undefined) {
          issueData.fields[field] = issue.fields[field];
        }
      });
      
      log('Processing search result issue', { 
        key: issueData.key,
        hasDueDate: !!issueData.dueDate,
        status: issueData.status,
        priority: issueData.priority,
        link: issueData.link
      });
      
      return issueData;
    });
    
    log('Enhanced JQL search completed successfully', { 
      totalResults: data.total,
      returnedIssues: issues.length,
      maxResults: data.maxResults
    });

    log('Issues processed', { totalIssues: issues.length });
    
    return { success: true, issues, skipped: false };
  } catch (err) {
    log('Error in executeJiraSearch', { error: err.message, stack: err.stack });
    return { success: false, error: err.message, issues: [] };
  }
};

// 处理通知的通用函数
const processNotification = async (issues) => {
  try {
    if (issues.length === 0) {
      log('No issues to process for notification');
      return { success: true, issues: [], skipped: false, notification: 'No issues found' };
    }
    
    // 获取所有配置的webhook URL
    log('Checking webhook configuration');
    const teamsWebhookUrl = await storage.get('teamsWebhookUrl');
    const feishuWebhookUrl = await storage.get('feishuWebhookUrl');
    const slackWebhookUrl = await storage.get('slackWebhookUrl'); // 新增Slack Webhook URL
    
    log('Webhook configuration check', { 
      hasTeamsWebhook: !!teamsWebhookUrl,
      hasFeishuWebhook: !!feishuWebhookUrl,
      hasSlackWebhook: !!slackWebhookUrl, // 新增Slack检查
      teamsWebhookUrl: teamsWebhookUrl ? '[REDACTED]' : null,
      feishuWebhookUrl: feishuWebhookUrl ? '[REDACTED]' : null,
      slackWebhookUrl: slackWebhookUrl ? '[REDACTED]' : null // 新增Slack URL日志
    });
    
    // 检查是否有配置的webhook
    const webhooks = [];
    if (teamsWebhookUrl) {
      webhooks.push({ url: teamsWebhookUrl, type: 'teams' });
    }
    if (feishuWebhookUrl) {
      webhooks.push({ url: feishuWebhookUrl, type: 'feishu' });
    }
    if (slackWebhookUrl) {
      webhooks.push({ url: slackWebhookUrl, type: 'slack' }); // 新增Slack webhook
    }
    
    if (webhooks.length === 0) {
      log('No webhook URLs configured, skipping notification');
      return { success: true, issues, skipped: false, notification: 'No webhook configured' };
    }
    
    // 格式化到期日期
    const formatDueDate = (dueDate) => {
      if (!dueDate) return 'No due date';
      const date = new Date(dueDate);
      const today = new Date();
      const diffTime = date - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) return `${dueDate} (Overdue)`;
      if (diffDays === 0) return `${dueDate} (Due today)`;
      if (diffDays === 1) return `${dueDate} (Due tomorrow)`;
      return `${dueDate} (${diffDays} days remaining)`;
    };
    
    // 创建通知消息函数
    const createTeamsMessage = (issues) => {
      return {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "007ACC", // 蓝色色调，与logo保持一致
        "summary": `Jira Due Date Alert - ${issues.length} issue(s) upcoming`,
        "title": "🔔 Jira Issue Reminder",
        "text": `You have ${issues.length} Jira issue(s) with approaching due dates:`,
        "sections": [{
          "activityTitle": "📋 Issues Requiring Attention",
          "facts": issues.map(issue => ({
            "name": `**[${issue.key}](${issue.link})** - ${issue.summary}`,
            "value": `📅 ${formatDueDate(issue.dueDate)}\n👤 Assignee: ${issue.assignee || 'Unassigned'}\n🎯 Priority: ${issue.priority || 'Not set'}\n📊 Status: ${issue.status || 'Unknown'}`
          })),
          "markdown": true
        }],

      };
    };
    
    const createFeishuMessage = (issues) => {
      const issueList = issues.map(issue => {
        const dueDateInfo = formatDueDate(issue.dueDate);
        return `• **<u>[${issue.key}](${issue.link})</u>** - ${issue.summary} \n 📅 ${dueDateInfo} | 👤 ${issue.assignee || 'Unassigned'} | 🎯 ${issue.priority || 'Not set'} | 📊 ${issue.status || 'Unknown'}`;
      }).join('\n');
      
      return {
        "msg_type": "interactive",
        "card": {
          "config": {
            "wide_screen_mode": true,
            "enable_forward": true
          },
          "header": {
            "title": {
              "tag": "plain_text",
              "content": "🔔 Jira Issue Reminder"
            },
            "template": "blue" // 将橙色改为蓝色
          },
          "elements": [
            {
              "tag": "div",
              "text": {
                "tag": "lark_md",
                "content": `You have **${issues.length}** Jira issue(s) that require attention:\n\n${issueList}`
              }
            },

          ]
        }
      };
    };
    
    // 新增Slack消息创建函数
    const createSlackMessage = (issues) => {
      const issueBlocks = issues.map(issue => {
        const dueDateInfo = formatDueDate(issue.dueDate);
        return {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `*<${issue.link}|${issue.key}>* - ${issue.summary}\n📅 ${dueDateInfo} | 👤 ${issue.assignee || 'Unassigned'} | 🎯 ${issue.priority || 'Not set'} | 📊 ${issue.status || 'Unknown'}`
          }
        };
      });
      
      return {
        "blocks": [
          {
            "type": "header",
            "text": {
              "type": "plain_text",
              "text": "🔔 Jira Issue Reminder",
              "emoji": true
            }
          },
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": `You have *${issues.length}* Jira issue(s) that require attention:`
            }
          },
          {
            "type": "divider"
          },
          ...issueBlocks
        ]
      };
    };
    
    // 向所有配置的webhook发送通知
    const notificationResults = [];
    
    for (const webhook of webhooks) {
      try {
        let alertMessage = null;
        
        if (webhook.type === 'teams') {
          alertMessage = createTeamsMessage(issues);
        } else if (webhook.type === 'feishu') {
          alertMessage = createFeishuMessage(issues);
        } else if (webhook.type === 'slack') {
          alertMessage = createSlackMessage(issues); // 新增Slack消息处理
        }
        
        if (alertMessage) {
          log(`Sending notification to ${webhook.type} webhook`, { 
            webhookType: webhook.type,
            issuesCount: issues.length,
            messageType: typeof alertMessage
          });
          
          const response = await fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(alertMessage),
          });
          
          if (response.ok) {
            log(`Notification sent successfully to ${webhook.type}`);
            notificationResults.push({ 
              type: webhook.type, 
              success: true, 
              status: response.status 
            });
          } else {
            log(`Failed to send notification to ${webhook.type}`, { 
              status: response.status,
              statusText: response.statusText 
            });
            notificationResults.push({ 
              type: webhook.type, 
              success: false, 
              status: response.status,
              error: response.statusText 
            });
          }
        }
      } catch (error) {
        log(`Error sending notification to ${webhook.type}`, { 
          error: error.message,
          webhookType: webhook.type 
        });
        notificationResults.push({ 
          type: webhook.type, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    // 检查通知结果
    const successfulNotifications = notificationResults.filter(r => r.success);
    const failedNotifications = notificationResults.filter(r => !r.success);
    
    log('Notification results', { 
      total: notificationResults.length,
      successful: successfulNotifications.length,
      failed: failedNotifications.length,
      failedTypes: failedNotifications.map(f => f.type)
    });
    
    if (successfulNotifications.length === 0) {
      log('All notifications failed');
      return { 
        success: false, 
        issues, 
        skipped: false, 
        notification: 'All notifications failed',
        notificationResults 
      };
    }
    
    log('Notification process completed successfully');
    return { 
      success: true, 
      issues, 
      skipped: false, 
      notification: `Notifications sent to ${successfulNotifications.length} webhook(s)`,
      notificationResults 
    };
  } catch (err) {
    log('Error in processNotification', { error: err.message, stack: err.stack });
    return { 
      success: false, 
      issues, 
      skipped: false, 
      notification: 'Error processing notifications',
      error: err.message 
    };
  }
};

export const checkDueDateAlert = async () => {
  try {
    // 获取用户设置的调度周期和时间
    const schedulePeriod = await storage.get('schedulePeriod');
    const scheduleTime = await storage.get('scheduleTime');
    
    log('Scheduled check triggered', { schedulePeriod, scheduleTime });
    
    // 如果没有设置调度周期或时间，使用默认值
    const safeSchedulePeriod = schedulePeriod?.value || schedulePeriod || 'Daily';
    const safeScheduleTime = scheduleTime || '17:00';
    
    // 解析目标时间（格式：HH:MM）
    const [targetHour, targetMinute] = safeScheduleTime.split(':').map(Number);
    
    // 获取当前时间
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // 检查当前时间是否在目标时间±5分钟范围内
    const timeDiff = Math.abs((currentHour * 60 + currentMinute) - (targetHour * 60 + targetMinute));
    if (timeDiff > 3) {
      log('Not in scheduled time window, skipping check');
      return { success: true, skipped: true, reason: 'Not in scheduled time window' };
    }
    
    // 检查周期设置
    let shouldRun = false;
    
    if (safeSchedulePeriod === 'Daily') {
      shouldRun = true;
    } else if (safeSchedulePeriod === 'Weekly') {
      // 每周日运行（可以根据需要调整）
      shouldRun = currentDay === 0;
    } else if (safeSchedulePeriod === 'Monday') {
      shouldRun = currentDay === 1;
    } else if (safeSchedulePeriod === 'Tuesday') {
      shouldRun = currentDay === 2;
    } else if (safeSchedulePeriod === 'Wednesday') {
      shouldRun = currentDay === 3;
    } else if (safeSchedulePeriod === 'Thursday') {
      shouldRun = currentDay === 4;
    } else if (safeSchedulePeriod === 'Friday') {
      shouldRun = currentDay === 5;
    } else if (safeSchedulePeriod === 'Saturday') {
      shouldRun = currentDay === 6;
    } else if (safeSchedulePeriod === 'Sunday') {
      shouldRun = currentDay === 0;
    }
    
    if (!shouldRun) {
      log('Not scheduled day, skipping check', { period: safeSchedulePeriod, currentDay });
      return { success: true, skipped: true, reason: 'Not scheduled day' };
    }
    
    log('Running scheduled check', { period: safeSchedulePeriod, time: safeScheduleTime, currentDay });
    
    // 从storage中获取用户配置的JQL查询条件
    const settings = await storage.get('settings');
    log('Retrieved JQL settings from storage', { 
      hasSettings: !!settings,
      settingsCount: settings ? settings.length : 0,
      settings: settings ? settings.map(s => ({ hasJql: !!s.jql, jqlLength: s.jql ? s.jql.length : 0 })) : []
    });
    
    // 如果没有配置JQL查询，使用默认查询
    if (!settings || settings.length === 0 || !settings.some(s => s.jql && s.jql.trim())) {
      log('No JQL settings found, using default query');
      const defaultJql = 'resolution = Unresolved AND duedate <= 7d AND duedate >= now() order by duedate ASC';
      const searchResult = await executeJiraSearch(defaultJql);
      if (searchResult.success && searchResult.issues.length > 0) {
        return await processNotification(searchResult.issues);
      }
      return searchResult;
    }
    
    // 执行所有配置的JQL查询
    const results = [];
    for (const setting of settings) {
      if (setting.jql && setting.jql.trim()) {
        try {
          log('Executing JQL query from settings', { 
            jql: setting.jql.substring(0, 100) + (setting.jql.length > 100 ? '...' : ''),
            jqlLength: setting.jql.length
          });
          
          const result = await executeJiraSearch(setting.jql);
          results.push(result);
        } catch (error) {
          log('Error executing JQL query from settings', { 
            jql: setting.jql.substring(0, 100) + (setting.jql.length > 100 ? '...' : ''),
            error: error.message
          });
          results.push({ success: false, error: error.message, jql: setting.jql });
        }
      }
    }
    
    // 合并所有成功的结果
    const allIssues = results
      .filter(result => result.success && result.issues)
      .flatMap(result => result.issues);
    
    log('Combined results from all JQL queries', { 
      totalQueries: settings.length,
      successfulQueries: results.filter(r => r.success).length,
      failedQueries: results.filter(r => !r.success).length,
      totalIssues: allIssues.length
    });
    
    if (allIssues.length === 0) {
      log('No issues found from any JQL query');
      return { success: true, issues: [], skipped: false, notification: 'No issues found' };
    }
    
    // 继续处理通知逻辑
    return await processNotification(allIssues);
  } catch (err) {
    log('Error checking due date alerts:', { error: err.message, stack: err.stack });
    throw err;
  }
};

// Enhanced JQL search using POST method
resolver.define('searchIssuesWithJql', async ({ payload }) => {
  const { jql, maxResults = 50, fields = ['key', 'summary', 'status', 'priority', 'assignee', 'duedate', 'updated'] } = payload;
  
  log('Starting JQL search with security validation', { 
    jql: jql ? jql.substring(0, 100) : 'empty', 
    maxResults, 
    fields 
  });
  
  // 安全验证：验证JQL查询
  if (!jql || !jql.trim()) {
    log('Empty JQL query provided');
    return { success: false, error: 'JQL query cannot be empty' };
  }
  
  if (!securityUtils.validateJqlQuery(jql)) {
    log('Invalid or dangerous JQL query detected', { jql: jql.substring(0, 100) });
    return { success: false, error: 'Invalid or potentially dangerous JQL query' };
  }
  
  // 安全清理：清理JQL查询
  const sanitizedJql = securityUtils.sanitizeInput(jql);
  
  log('JQL query validated and sanitized', { 
    originalLength: jql.length, 
    sanitizedLength: sanitizedJql.length,
    jql: sanitizedJql.substring(0, 100) 
  });
  
  try {
    const result = await executeJiraSearch(sanitizedJql, maxResults, fields);
    log('JQL search completed with security validation', { 
      success: result.success, 
      issuesCount: result.issues ? result.issues.length : 0 
    });
    return result;
  } catch (error) {
    log('Error in secure JQL search', { error: error.message });
    return { success: false, error: error.message };
  }
});

// Get Teams Webhook URL
// resolver.define('getTeamsWebhookUrl', async () => {
//   log('Fetching Teams webhook URL from storage');
//   const url = await storage.get('teamsWebhookUrl');
//   log('Teams webhook URL fetched', { 
//     hasUrl: !!url,
//     urlLength: url ? url.length : 0,
//     urlPreview: url ? `${url.substring(0, 20)}...` : null
//   });
//   return { url };
// });

// Save Teams Webhook URL
// Save Teams Webhook URL
// resolver.define('saveTeamsWebhookUrl', async ({ payload }) => {
//   log('Saving user settings', { 
//     payloadType: typeof payload,
//     payloadKeys: payload ? Object.keys(payload) : []
//   });
//   const { teamsWebhookUrl='https://your-tenant.webhook.office.com/webhookb2/' } = payload;
//   log(teamsWebhookUrl)
//   
//   if (!teamsWebhookUrl || teamsWebhookUrl.trim() === '') {
//     log('Empty URL provided, deleting stored webhook');
//     await storage.delete('teamsWebhookUrl');
//     log('Teams webhook URL deleted successfully');
//     return { success: true, message: 'Webhook URL deleted' };
//   }
//   
//   // Basic URL validation
//   log('Validating Teams webhook URL format');
//   if (!teamsWebhookUrl.startsWith('https://')) {
//     log('Invalid Teams webhook URL format', { url: teamsWebhookUrl.substring(0, 50) + '...' });
//     return { success: false, message: 'URL must start with https://' };
//   }
//   
//   // Additional validation for Teams webhook URLs
//   if (!teamsWebhookUrl.includes('webhook') && !teamsWebhookUrl.includes('office.com')) {
//     log('Suspicious Teams webhook URL format', { url: teamsWebhookUrl.substring(0, 50) + '...' });
//     log('Warning: URL does not contain typical Teams webhook patterns');
//   }
//   
//   await storage.set('teamsWebhookUrl', teamsWebhookUrl);
//   log('Teams webhook URL saved successfully', { urlLength: teamsWebhookUrl.length });
//   return { success: true, message: 'Webhook URL saved' };
// });

// Get Feishu Webhook URL
resolver.define('getFeishuWebhookUrl', async () => {
  log('Fetching Feishu webhook URL from storage');
  const url = await storage.get('feishuWebhookUrl');
  log('Feishu webhook URL fetched', { 
    hasUrl: !!url,
    urlLength: url ? url.length : 0,
    urlPreview: url ? `${url.substring(0, 20)}...` : null
  });
  return { feishuWebhookUrl: url };
});

// Save Feishu Webhook URL
resolver.define('saveFeishuWebhookUrl', async ({ payload }) => {
  log('Saving user settings', { 
    payloadType: typeof payload,
    payloadKeys: payload ? Object.keys(payload) : []
  });
  const { feishuWebhookUrl='https://open.feishu.cn/open-apis/bot/v2/hook/' } = payload;
  log({feishuWebhookUrl});
  
  if (!feishuWebhookUrl || feishuWebhookUrl.trim() === '') {
    log('Empty URL provided, deleting stored webhook');
    await storage.delete('feishuWebhookUrl');
    log('Feishu webhook URL deleted successfully');
    return { success: true, message: 'Webhook URL deleted' };
  }
  
  // Basic URL validation
  log('Validating Feishu webhook URL format');
  if (!feishuWebhookUrl.startsWith('https://')) {
    log('Invalid Feishu webhook URL format', { url: url.substring(0, 50) + '...' });
    return { success: false, message: 'URL must start with https://' };
  }
  
  // Additional validation for Feishu webhook URLs
  if (!feishuWebhookUrl.includes('open.feishu.cn')) {
    log('Suspicious Feishu webhook URL format', { url: url.substring(0, 50) + '...' });
    log('Warning: URL does not contain typical Feishu webhook patterns');
  }
  
  await storage.set('feishuWebhookUrl', feishuWebhookUrl);
  log('Feishu webhook URL saved successfully', { urlLength: feishuWebhookUrl.length });
  return { success: true, message: 'Webhook URL saved' };
});

// Get Slack Webhook URL
resolver.define('getSlackWebhookUrl', async () => {
  log('Fetching Slack webhook URL from storage');
  const url = await storage.get('slackWebhookUrl');
  log('Slack webhook URL fetched', { 
    hasUrl: !!url,
    urlLength: url ? url.length : 0,
    urlPreview: url ? `${url.substring(0, 20)}...` : null
  });
  return { slackWebhookUrl: url };
});

// Save Slack Webhook URL
resolver.define('saveSlackWebhookUrl', async ({ payload }) => {
  log('Saving Slack webhook URL', { 
    payloadType: typeof payload,
    payloadKeys: payload ? Object.keys(payload) : []
  });
  const { slackWebhookUrl } = payload;
  
  if (!slackWebhookUrl || slackWebhookUrl.trim() === '') {
    log('Empty URL provided, deleting stored webhook');
    await storage.delete('slackWebhookUrl');
    log('Slack webhook URL deleted successfully');
    return { success: true, message: 'Webhook URL deleted' };
  }
  
  // Basic URL validation
  log('Validating Slack webhook URL format');
  if (!slackWebhookUrl.startsWith('https://')) {
    log('Invalid Slack webhook URL format', { url: slackWebhookUrl.substring(0, 50) + '...' });
    return { success: false, message: 'URL must start with https://' };
  }
  
  // Additional validation for Slack webhook URLs
  if (!slackWebhookUrl.includes('hooks.slack.com')) {
    log('Suspicious Slack webhook URL format', { url: slackWebhookUrl.substring(0, 50) + '...' });
    log('Warning: URL does not contain typical Slack webhook patterns');
  }
  
  await storage.set('slackWebhookUrl', slackWebhookUrl);
  log('Slack webhook URL saved successfully', { urlLength: slackWebhookUrl.length });
  return { success: true, message: 'Webhook URL saved' };
});

// Save Jira Site URL
resolver.define('saveJiraSiteUrl', async ({ payload }) => {
  log('Saving Jira site URL', { 
    payloadType: typeof payload,
    payloadKeys: payload ? Object.keys(payload) : []
  });
  const { jiraSiteUrl } = payload;
  
  if (!jiraSiteUrl || jiraSiteUrl.trim() === '') {
    log('Empty Jira site URL provided, deleting stored URL');
    await storage.delete('jiraSiteUrl');
    log('Jira site URL deleted successfully');
    return { success: true, message: 'Jira site URL deleted' };
  }
  
  // Basic URL validation
  log('Validating Jira site URL format');
  if (!jiraSiteUrl.startsWith('https://')) {
    log('Invalid Jira site URL format', { url: jiraSiteUrl.substring(0, 50) + '...' });
    return { success: false, message: 'Jira site URL must start with https://' };
  }
  
  // Additional validation for Jira site URLs
  if (!jiraSiteUrl.includes('.atlassian.net') && !jiraSiteUrl.includes('jira.')) {
    log('Suspicious Jira site URL format', { url: jiraSiteUrl.substring(0, 50) + '...' });
    log('Warning: URL does not contain typical Jira site patterns');
  }
  
  await storage.set('jiraSiteUrl', jiraSiteUrl);
  log('Jira site URL saved successfully', { urlLength: jiraSiteUrl.length });
  return { success: true, message: 'Jira site URL saved' };
});



// Save schedule period
resolver.define('saveschedulePeriod', async (req) => {
  log('Saving schedule period', { payload: req.payload });
  const { schedulePeriod } = req.payload;
  log('Extracted schedulePeriod from payload', schedulePeriod);
  
  // 验证 payload 结构
  if (typeof schedulePeriod !== 'object' || schedulePeriod === null) {
    log('Invalid payload structure', { 
      type: typeof schedulePeriod,
      isNull: schedulePeriod === null 
    });
    throw new Error('Invalid payload: schedulePeriod must be an object');
  }
  
  // 验证必需的属性
  if (!schedulePeriod.label || !schedulePeriod.value) {
    log('Missing required properties', { 
      hasLabel: !!schedulePeriod.label,
      hasValue: !!schedulePeriod.value,
      availableKeys: Object.keys(schedulePeriod)
    });
    throw new Error('Invalid payload: schedulePeriod must have both label and value properties');
  }
  
  // 验证 value 是否在允许的选项中
  const validValues = periodOptions.map(o => o.value);
  log('Validating schedule period value', { 
    receivedValue: schedulePeriod.value,
    validValues,
    isValid: validValues.includes(schedulePeriod.value)
  });
  
  if (!periodOptions.some(option => option.value === schedulePeriod.value)) {
    throw new Error(`Invalid payload: schedulePeriod.value must be one of ${validValues.join(', ')}`);
  }
  
  // 保存到存储
  log('Saving schedule period to storage', schedulePeriod);
  await storage.set('schedulePeriod', schedulePeriod);
  log('Successfully saved schedulePeriod', schedulePeriod);
  
  return { success: true, schedulePeriod };
});

export const handler = resolver.getDefinitions();

// 安全验证工具函数
const securityUtils = {
  // 验证JQL查询的安全性，防止注入攻击
  validateJqlQuery: (jql) => {
    if (!jql || typeof jql !== 'string') return false;
    
    // 移除多余空格并转换为小写进行验证
    const normalizedJql = jql.trim().toLowerCase();
    
    // 检查JQL长度限制（防止过长的恶意查询）
    if (normalizedJql.length > 10000) {
      log('JQL query too long, potential DoS attack', { length: normalizedJql.length });
      return false;
    }
    
    // 检查危险的JQL操作符和关键字
    const dangerousPatterns = [
      /\bupdate\s+set\b/i,        // UPDATE SET操作
      /\binsert\s+into\b/i,       // INSERT INTO操作
      /\bdelete\s+from\b/i,       // DELETE FROM操作
      /\bdrop\s+table\b/i,        // DROP TABLE操作
      /\bcreate\s+table\b/i,      // CREATE TABLE操作
      /\balter\s+table\b/i,       // ALTER TABLE操作
      /;\s*\w/i,                  // 分号后跟字符（多语句攻击）
      /--\s*\w/i,                 // SQL注释攻击
      /\/\*.*\*\//i,              // 多行注释攻击
      /union\s+select/i,          // UNION SELECT攻击
      /exec\s*\(/i,               // 执行命令攻击
      /xp_cmdshell/i,             // SQL Server命令执行
      /load_file\s*\(/i,          // 文件读取攻击
      /into\s+outfile/i,          // 文件写入攻击
      /benchmark\s*\(/i,          // 性能攻击
      /sleep\s*\(/i,              // 延迟攻击
      /waitfor\s+delay/i          // SQL Server延迟攻击
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(normalizedJql)) {
        log('Dangerous JQL pattern detected', { pattern: pattern.source, jql: jql.substring(0, 100) });
        return false;
      }
    }
    
    return true;
  },
  
  // 验证Webhook URL的安全性
  validateWebhookUrl: (url) => {
    if (!url || typeof url !== 'string') return false;
    
    const normalizedUrl = url.trim();
    
    // 检查URL长度限制
    if (normalizedUrl.length > 2000) {
      log('Webhook URL too long', { length: normalizedUrl.length });
      return false;
    }
    
    // 验证URL格式
    try {
      const urlObj = new URL(normalizedUrl);
      
      // 只允许HTTPS协议（生产环境要求）
      if (urlObj.protocol !== 'https:') {
        log('Webhook URL must use HTTPS', { protocol: urlObj.protocol });
        return false;
      }
      
      // 检查域名白名单（可选，根据需求配置）
      const allowedDomains = [
        'webhook.office.com',      // Microsoft Teams
        'open.feishu.cn',          // 飞书
        'hooks.slack.com',         // Slack
        'hooks.zapier.com',        // Zapier
        'webhook.site'             // 测试用途
      ];
      
      const isDomainAllowed = allowedDomains.some(domain => 
        urlObj.hostname.endsWith(domain)
      );
      
      if (!isDomainAllowed) {
        log('Webhook domain not in allowed list', { hostname: urlObj.hostname });
        return false;
      }
      
      return true;
    } catch (error) {
      log('Invalid webhook URL format', { error: error.message, url: normalizedUrl.substring(0, 100) });
      return false;
    }
  },
  
  // 清理和转义用户输入
  sanitizeInput: (input) => {
    if (typeof input !== 'string') return input;
    
    // 移除潜在的恶意字符
    return input
      .replace(/[<>\"\']/g, '')  // 移除HTML/XML特殊字符
      .replace(/\s+/g, ' ')       // 规范化空格
      .trim()                     // 移除首尾空格
      .substring(0, 10000);       // 长度限制
  },
  
  // 验证设置数据的结构
  validateSettingsStructure: (settings) => {
    if (!Array.isArray(settings)) return false;
    
    // 限制设置项数量
    if (settings.length > 50) {
      log('Too many settings items', { count: settings.length });
      return false;
    }
    
    for (const setting of settings) {
      if (typeof setting !== 'object' || setting === null) return false;
      
      // 验证每个设置项的结构
      if (setting.jql && typeof setting.jql !== 'string') return false;
      
      // 验证JQL长度
      if (setting.jql && setting.jql.length > 10000) return false;
    }
    
    return true;
  }
};