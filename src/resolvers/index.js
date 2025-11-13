import Resolver from '@forge/resolver';
import { storage, requestJira } from '@forge/api';

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
  // Read the settings array stored under the 'settings' key
  const stored = await storage.get('settings');
  const settings = stored || [];
  log('Fetched settings', settings);
  return { settings };
});

// Get schedule period as Option object
resolver.define('getschedulePeriod', async () => {
  let schedulePeriod = await storage.get('schedulePeriod');
  
  log('Raw schedulePeriod from storage', schedulePeriod);
  
  // 如果存储的是字符串，转换为 Option 对象
  if (typeof schedulePeriod === 'string') {
    const matchedOption = periodOptions.find(option => option.value === schedulePeriod);
    if (matchedOption) {
      schedulePeriod = matchedOption;
      // 更新存储为 Option 对象格式
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
    schedulePeriod = { label: 'Daily', value: 'Daily' };
    await storage.set('schedulePeriod', schedulePeriod);
    log('Set initial default Option object', schedulePeriod);
  }

  log('Fetched schedulePeriod as Option object', schedulePeriod);
  return { schedulePeriod };
});

resolver.define('getscheduleTime', async () => {
  let scheduleTime = await storage.get('scheduleTime');
  // If scheduleTime is an object, try to extract a primitive value, otherwise null
  if (typeof scheduleTime === 'object' && scheduleTime !== null) {
    if (scheduleTime.target && typeof scheduleTime.target.value !== 'undefined') {
      scheduleTime = String(scheduleTime.target.value);
    } else if (typeof scheduleTime.value !== 'undefined') {
      scheduleTime = String(scheduleTime.value);
    } else {
      scheduleTime = null;
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
  
  if (!scheduleTime || typeof scheduleTime !== 'string' || !isValidTimeFormat(scheduleTime)) {
    const defaultTime = '17:00';
    await storage.set('scheduleTime', defaultTime);
    log('Normalized scheduleTime to default', defaultTime);
    return { scheduleTime: defaultTime };
  }

  log('Fetched scheduleTime', scheduleTime);
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
    
    // 执行实际的Jira检查
    const jiraApiUrl = 'https://your-jira-instance.atlassian.net/rest/api/2/search';
    const jql = 'project=YOUR_PROJECT_KEY AND due <= now()+1d';
    
    const response = await requestJira(jiraApiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      query: {
        jql,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Jira API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    const issues = data.issues.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      dueDate: issue.fields.duedate,
    }));
    
    if (issues.length > 0) {
      // Send Teams alert
      const teamsWebhookUrl = 'YOUR_TEAMS_WEBHOOK_URL';
      const alertMessage = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "0076D7",
        "summary": "Jira Due Date Alert",
        "sections": [{
          "activityTitle": "Upcoming Jira Due Dates",
          "facts": issues.map(issue => ({
            "name": `${issue.key}: ${issue.summary}`,
            "value": `Due: ${issue.dueDate}`
          })),
          "markdown": true
        }]
      };
      
      await api.fetch(teamsWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertMessage),
      });
      
      log('Alert sent successfully', { issueCount: issues.length });
    } else {
      log('No issues found with upcoming due dates');
    }
    
    return { success: true, issues, skipped: false };
  } catch (error) {
    error('Error checking due date alerts:', error);
    throw error;
  }
};

export const handler = resolver.getDefinitions();