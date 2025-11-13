import Resolver from '@forge/resolver';
import { api, storage, requestJira, route } from '@forge/api';

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
  // payload contains settings (array), schedulePeriod (string) and scheduleTime (string)
  const { settings = [], schedulePeriod = { label: 'Daily', value: 'Daily' }, scheduleTime = '17:00' } = payload;

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
  const safeScheduleTime = extractScheduleTime(scheduleTime);

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
  await storage.set('settings', settings);

  // Store schedule settings separately (always as strings)
  await storage.set('schedulePeriod', safeSchedulePeriod);
  await storage.set('scheduleTime', validatedScheduleTime);

  log('Saved user settings', { settings, schedulePeriod: safeSchedulePeriod, scheduleTime: safeScheduleTime });
  return { success: true };
});

// Get all settings
resolver.define('getSettings', async () => {
  log('Fetching user settings from storage');
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
  log('Fetching schedule period from storage');
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
    if (timeDiff > 5) {
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
    
    log('Running scheduled check', { period: safeSchedulePeriod, time: safeScheduleTime });
    
    // 执行实际的Jira检查 - 使用POST方法进行增强JQL搜索
    const jql = 'assignee = currentUser() AND resolution = Unresolved AND duedate <= 7d AND duedate >= now() order by duedate ASC';
    
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
    
    const response = await requestJira(route`/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    log('Jira API response received', { 
      status: response.status, 
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      log('Jira API error response', { status: response.status, errorText });
      throw new Error(`Jira API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    log('Jira API data parsed successfully', { 
      totalIssues: data.total || 0,
      maxResults: data.maxResults || 0,
      issuesCount: data.issues ? data.issues.length : 0
    });
    
    const issues = data.issues.map(issue => {
      const issueData = {
        key: issue.key,
        summary: issue.fields.summary,
        dueDate: issue.fields.duedate,
        status: issue.fields.status?.name,
        priority: issue.fields.priority?.name,
        assignee: issue.fields.assignee?.displayName,
      };
      
      log('Processing issue', { 
        key: issueData.key, 
        hasDueDate: !!issueData.dueDate,
        status: issueData.status,
        priority: issueData.priority
      });
      
      return issueData;
    });
    
    log('Issues processed', { totalIssues: issues.length });
    
    if (issues.length > 0) {
      // 获取配置的Teams Webhook URL
      log('Checking Teams webhook configuration');
      const teamsWebhookUrl = await storage.get('teamsWebhookUrl');
      
      log('Teams webhook configuration check', { 
        hasWebhook: !!teamsWebhookUrl,
        webhookUrl: teamsWebhookUrl ? '[REDACTED]' : null
      });
      
      if (!teamsWebhookUrl) {
        log('No Teams webhook URL configured, skipping notification');
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
      
      // 创建更详细的Teams通知消息
      const alertMessage = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "FF6B35", // 橙色表示警告
        "summary": `Jira Due Date Alert - ${issues.length} issue(s) upcoming`,
        "title": "🔔 Jira Due Date Alert",
        "text": `You have ${issues.length} Jira issue(s) with approaching due dates:`,
        "sections": [{
          "activityTitle": "📋 Issues Requiring Attention",
          "facts": issues.map(issue => ({
            "name": `**${issue.key}** - ${issue.summary}`,
            "value": `📅 ${formatDueDate(issue.dueDate)}\n🎯 Priority: ${issue.priority || 'Not set'}\n📊 Status: ${issue.status || 'Unknown'}`
          })),
          "markdown": true
        }],
        "potentialAction": [
          {
            "@type": "OpenUri",
            "name": "View All Issues",
            "targets": [
              {
                "os": "default",
                "uri": "/issues/?jql=assignee%20%3D%20currentUser()%20AND%20resolution%20%3D%20Unresolved%20AND%20duedate%20%3C%3D%207d%20ORDER%20BY%20duedate%20ASC"
              }
            ]
          }
        ]
      };
      
      try {
        log('Sending Teams notification', { 
          webhookUrl: '[REDACTED]',
          messageSize: JSON.stringify(alertMessage).length,
          issueCount: issues.length
        });
        
        const teamsResponse = await api.fetch(teamsWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(alertMessage),
        });
        
        log('Teams API response received', { 
          status: teamsResponse.status,
          statusText: teamsResponse.statusText,
          ok: teamsResponse.ok
        });
        
        if (!teamsResponse.ok) {
          const errorText = await teamsResponse.text();
          log('Teams API error response', { status: teamsResponse.status, errorText });
          throw new Error(`Teams API request failed: ${teamsResponse.status} ${teamsResponse.statusText}`);
        }
        
        log('Alert sent successfully', { issueCount: issues.length });
        return { success: true, issues, skipped: false, notification: 'Sent successfully' };
      } catch (notificationError) {
        log('Failed to send Teams notification:', { error: notificationError.message, stack: notificationError.stack });
        return { success: true, issues, skipped: false, notification: 'Failed to send notification', error: notificationError.message };
      }
    } else {
      log('No issues found with upcoming due dates');
      return { success: true, issues: [], skipped: false, notification: 'No issues found' };
    }
    
    return { success: true, issues, skipped: false };
  } catch (err) {
    log('Error checking due date alerts:', { error: err.message, stack: err.stack });
    throw err;
  }
};

// Get JQL reference data to help with query building
resolver.define('getJqlReferenceData', async () => {
  try {
    log('Fetching JQL reference data from /rest/api/3/jql/autocompletedata');
    const jiraApi = api.asUser();
    const response = await jiraApi.requestJira(route`/rest/api/3/jql/autocompletedata`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    log('JQL reference data API response received', { 
      status: response.status, 
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      log('JQL reference data API error response', { status: response.status, errorText });
      throw new Error(`Jira API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    log('JQL reference data parsed successfully', { 
      fieldNamesCount: data.visibleFieldNames ? data.visibleFieldNames.length : 0,
      functionNamesCount: data.visibleFunctionNames ? data.visibleFunctionNames.length : 0,
      reservedWordsCount: data.jqlReservedWords ? data.jqlReservedWords.length : 0
    });
    
    return {
      success: true,
      data: {
        visibleFieldNames: data.visibleFieldNames || [],
        visibleFunctionNames: data.visibleFunctionNames || [],
        jqlReservedWords: data.jqlReservedWords || [],
      }
    };
  } catch (err) {
    log('Error fetching JQL reference data:', { error: err.message, stack: err.stack });
    return {
      success: false,
      error: err.message
    };
  }
});

const checkUserExists = async (username) => {
  try {
    const response = await requestJira(route`/rest/api/3/user/search?query=${username}`);
    const users = await response.json();
    console.log(`Found ${users.length} users matching "${username}":`);
    users.forEach(user => {
      console.log(`- ${user.displayName} (${user.name}) - ${user.emailAddress}`);
    });
    return users;
  } catch (error) {
    console.error('Error searching for user:', error);
    return [];
  }
};


const debugAssigneeQuery = async () => {
  console.log('=== 开始 JQL 查询调试 ===');
  
  // 1. 检查当前用户
  try {
    const userResponse = await requestJira(route`/rest/api/3/myself`);  
    console.log(userResponse)
    const currentUser = await userResponse.json();
    console.log('1. 当前用户信息:');
    console.log('   - Display Name:', currentUser.displayName);
    console.log('   - Account ID:', currentUser.accountId);
    console.log('   - Name:', currentUser.name);
    console.log('   - Email:', currentUser.emailAddress);
  } catch (error) {
    console.error('获取当前用户信息失败:', error);
  }
  
  // 2. 搜索用户
  console.log('\n2. 搜索用户 "wangbo":');
  await checkUserExists('wangbo');
  
  // 3. 测试不同的查询条件
  console.log('\n3. 测试不同的查询条件:');
  
  const testQueries = [
    { name: '原始查询', jql: 'assignee = wangbo AND resolution = Unresolved' },
    { name: '仅分配人', jql: 'assignee = wangbo' },
    { name: '仅未解决', jql: 'resolution = Unresolved' },
    { name: '当前用户的问题', jql: 'assignee = currentUser()' },
    { name: '所有未分配的问题', jql: 'assignee is empty' },
    { name: '所有问题', jql: 'order by updated DESC' }
  ];
  
  for (const test of testQueries) {
    try {
      const response = await requestJira(route`/rest/api/3/search`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        query: {
          jql: test.jql,
          maxResults: 3,
          fields: ['key', 'summary', 'status', 'assignee', 'resolution']
        }
      });
      
      const data = await response.json();

      
      if (data.issues && data.issues.length > 0) {
        data.issues.forEach(issue => {
          const assignee = issue.fields.assignee;
          const resolution = issue.fields.resolution;
          console.log(`   - ${issue.key}: ${issue.fields.summary}`);
          console.log(`     分配人: ${assignee ? assignee.displayName : '未分配'}`);
          console.log(`     解决状态: ${resolution ? resolution.name : '未解决'}`);
        });
      }
    } catch (error) {
      console.error(`   查询失败: ${error.message}`);
    }
  }
  
  console.log('=== 调试完成 ===');
};


// Enhanced JQL search using POST method
resolver.define('searchIssuesWithJql', async (req) => {
  
  
  await debugAssigneeQuery();
  const { jql, maxResults = 50, fields = ['key', 'summary', 'status', 'priority', 'assignee', 'duedate', 'updated'] } = req.payload;
  
  log('Processing enhanced JQL search request', { 
    jql, 
    maxResults, 
    fieldsCount: fields.length 
  });
  
  if (!jql || typeof jql !== 'string') {
    log('Invalid JQL query provided', { jql, type: typeof jql });
    throw new Error('JQL query is required and must be a string');
  }
  
  try {
    // 使用POST方法进行增强JQL搜索
    const requestBody = {
      jql: jql.trim(),
      maxResults: Math.min(maxResults, 100), // 限制最大结果为100
      fields: fields
    };
    
    log('Making enhanced JQL search request', { 
      endpoint: '/rest/api/3/search/jql',
      requestBody: { ...requestBody, jql: requestBody.jql.substring(0, 100) + (requestBody.jql.length > 100 ? '...' : '') }
    });
    
    const response = await requestJira(route`/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    log('Enhanced JQL search response received', { 
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      log('Enhanced JQL search error response', { status: response.status, errorText });
      throw new Error(`JQL search failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    log('Enhanced JQL search data parsed successfully', { 
      totalIssues: data.total || 0,
      maxResults: data.maxResults || 0,
      issuesCount: data.issues ? data.issues.length : 0
    });
    
    // 处理返回的issues数据
    const issues = data.issues.map(issue => {
      const issueData = {
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status?.name,
        priority: issue.fields.priority?.name,
        assignee: issue.fields.assignee?.displayName,
        dueDate: issue.fields.duedate,
        updated: issue.fields.updated,
        fields: {}
      };
      
      // 包含请求的所有字段
      fields.forEach(field => {
        if (issue.fields[field] !== undefined) {
          issueData.fields[field] = issue.fields[field];
        }
      });
      
      log('Processing search result issue', { 
        key: issueData.key,
        hasDueDate: !!issueData.dueDate,
        status: issueData.status,
        priority: issueData.priority
      });
      
      return issueData;
    });
    
    log('Enhanced JQL search completed successfully', { 
      totalResults: data.total,
      returnedIssues: issues.length,
      maxResults: data.maxResults
    });
    
    return {
      success: true,
      data: {
        issues: issues,
        total: data.total || 0,
        maxResults: data.maxResults || 0
      }
    };
  } catch (err) {
    log('Error in enhanced JQL search', { error: err.message, stack: err.stack });
    return {
      success: false,
      error: err.message
    };
  }
});

// Get Teams Webhook URL
resolver.define('getTeamsWebhookUrl', async () => {
  log('Fetching Teams webhook URL from storage');
  const url = await storage.get('teamsWebhookUrl');
  log('Teams webhook URL fetched', { 
    hasUrl: !!url,
    urlLength: url ? url.length : 0,
    urlPreview: url ? `${url.substring(0, 20)}...` : null
  });
  return { url };
});

// Save Teams Webhook URL
// Save Teams Webhook URL
resolver.define('saveTeamsWebhookUrl', async ({ url }) => {
  log('Saving Teams webhook URL', { 
    receivedUrl: url ? '[REDACTED]' : null,
    urlLength: url ? url.length : 0
  });
  
  if (!url || url.trim() === '') {
    log('Empty URL provided, deleting stored webhook');
    await storage.delete('teamsWebhookUrl');
    log('Teams webhook URL deleted successfully');
    return { success: true, message: 'Webhook URL deleted' };
  }
  
  // Basic URL validation
  log('Validating Teams webhook URL format');
  if (!url.startsWith('https://')) {
    log('Invalid Teams webhook URL format', { url: url.substring(0, 50) + '...' });
    return { success: false, message: 'URL must start with https://' };
  }
  
  // Additional validation for Teams webhook URLs
  if (!url.includes('webhook') && !url.includes('office.com')) {
    log('Suspicious Teams webhook URL format', { url: url.substring(0, 50) + '...' });
    log('Warning: URL does not contain typical Teams webhook patterns');
  }
  
  await storage.set('teamsWebhookUrl', url);
  log('Teams webhook URL saved successfully', { urlLength: url.length });
  return { success: true, message: 'Webhook URL saved' };
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