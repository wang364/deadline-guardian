import React, { useState, useEffect } from 'react';
import { invoke, view } from '@forge/bridge';
import ForgeReconciler, {
  Box,
  Button,
  Label,
  Select,
  Option,
  Text,
  Textfield,
  TimePicker,
  ErrorMessage,
} from '@forge/react';
import SettingsTable from '../components/SettingsTable';

// 多语言配置
const translations = {
  en: {
    appTitle: "Jira Issue Reminder",
    settings: "Settings",
    save: "Save",
    cancel: "Cancel",
    success: "Success",
    error: "Error",
    optional: "optional",
    
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
    selectTime: "Select time",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    
    // 语言设置
    languageSettings: "Language Settings",
    language: "Language",
    english: "English",
    chinese: "Chinese",
    
    // 成功消息
    settingsSaved: "Settings saved successfully",
    settingsFailed: "Failed to save settings",
    webhookSaved: "Webhook URL saved successfully",
    webhookFailed: "Failed to save webhook URL",
    
    // 通知说明
    notificationExplanation: "Notifications will be sent to all configured webhook URLs. Leave blank to disable notifications for a specific platform.",
    
    // 加载状态
    loadingSettings: "Loading settings...",
    
    // 错误消息
    invalidTimeFormat: "Please enter a valid time format (HH:MM)"
  },
  
  zh: {
    appTitle: "Jira 问题提醒",
    settings: "设置",
    save: "保存",
    cancel: "取消",
    success: "成功",
    error: "错误",
    optional: "可选",
    
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
    selectTime: "选择时间",
    daily: "每日",
    weekly: "每周",
    monthly: "每月",
    
    // 语言设置
    languageSettings: "语言设置",
    language: "语言",
    english: "英语",
    chinese: "中文",
    
    // 成功消息
    settingsSaved: "设置保存成功",
    settingsFailed: "设置保存失败",
    webhookSaved: "Webhook URL 保存成功",
    webhookFailed: "Webhook URL 保存失败",
    
    // 通知说明
    notificationExplanation: "通知将发送到所有已配置的 webhook URL。留空可禁用特定平台的通知。",
    
    // 加载状态
    loadingSettings: "正在加载设置...",
    
    // 错误消息
    invalidTimeFormat: "请输入有效的时间格式 (HH:MM)"
  }
};

// 翻译函数
const t = (key, params = {}, lang = 'en') => {
  let translation = translations[lang]?.[key] || translations['en'][key] || key;
  
  // 替换参数
  if (params && Object.keys(params).length > 0) {
    Object.keys(params).forEach(param => {
      translation = translation.replace(`{${param}}`, params[param]);
    });
  }
  
  return translation;
};

// 使用后端解析器封装时间转换，避免直接传递包含函数的对象
const convertLocalTimeToGMT = async (localTime) => {
  try {
    return await invoke('convertLocalTimeToGMT', { localTime });
  } catch (error) {
    console.error('Error converting local time to GMT:', error);
    return localTime;
  }
};

const convertGMTToLocalTime = async (gmtTime) => {
  try {
    return await invoke('convertGMTToLocalTime', { gmtTime });
  } catch (error) {
    console.error('Error converting GMT to local time:', error);
    return gmtTime;
  }
};

const App = () => {
  const [settings, setSettings] = useState([{ jql: '' }]);
  const [schedulePeriod, setSchedulePeriod] = useState({ label: 'Daily', value: 'Daily' });
  const [scheduleTime, setScheduleTime] = useState('17:00');
  // const [teamsWebhookUrl, setTeamsWebhookUrl] = useState('');
  const [feishuWebhookUrl, setFeishuWebhookUrl] = useState('');
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(''); // 新增Slack Webhook URL状态
  const [wechatworkWebhookUrl, setWeChatWorkWebhookUrl] = useState(''); // 新增WeChat Work Webhook URL状态
  const [language, setLanguage] = useState('en'); // 新增语言设置状态
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [webhookError, setWebhookError] = useState('');
  const [message, setMessage] = useState('');

    // 定义选项数组
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

  // Normalizers to ensure values from resolvers match the Select/Textfield expected formats
  const normalizePeriod = (val) => {
    if (!val || typeof val !== 'string') return { label: 'Daily', value: 'Daily' };
    const v = val.trim();
    
    // 查找匹配的选项对象
    const matchedOption = periodOptions.find(option => option.value === v);
    console.log('Normalizing period:', v, 'Matched option:', matchedOption);
    
    return matchedOption || { label: 'Daily', value: 'Daily' };
  };

  // 简化版本的normalizeTime，允许用户自由输入，只在保存时验证
  const normalizeTime = (val) => {
    if (!val || typeof val !== 'string') return '17:00';
    const v = val.trim();
    // 直接返回用户输入的值，不做任何验证或转换
    return v;
  };
  
  // 改进的时间格式验证函数，支持多种格式：H:M, HH:M, H:MM, HH:MM
  // 使用后端的时间工具函数
  const validateTimeFormat = async (time) => {
    try {
      return await invoke('validateTimeFormat', { time });
    } catch (error) {
      console.error('Error validating time format:', error);
      return false;
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        
        // 从Jira上下文获取语言设置
        const context = await view.getContext();
        const jiraLanguage = context?.locale || 'en';
        // 简化为只支持中英文，根据Jira的语言设置自动检测
        const detectedLanguage = jiraLanguage.startsWith('zh') ? 'zh' : 'en';
        setLanguage(detectedLanguage);
        
        // 保存语言设置到storage供后台使用
        await invoke('saveLanguageToStorage', { language: detectedLanguage });
        
        // 获取用户设置
        const settingsResponse = await invoke('getSettings');
        const settingsData = settingsResponse.settings || [ { jql: '' } ];
        setSettings(settingsData);
        
        // 获取调度周期
        const periodResponse = await invoke('getschedulePeriod');
        const periodData = periodResponse.schedulePeriod || { label: 'Daily', value: 'Daily' };
        setSchedulePeriod(periodData);
        
        // 获取调度时间
        const timeResponse = await invoke('getscheduleTime');
        const timeData = timeResponse.scheduleTime || '17:00';
        const localTime = await convertGMTToLocalTime(timeData);
        setScheduleTime(localTime);
        
        // 获取飞书Webhook URL
        const feishuWebhookResponse = await invoke('getFeishuWebhookUrl');
        const feishuWebhookData = feishuWebhookResponse.feishuWebhookUrl || '';
        setFeishuWebhookUrl(feishuWebhookData);
        
        // 获取Slack Webhook URL
        const slackWebhookResponse = await invoke('getSlackWebhookUrl');
        const slackWebhookData = slackWebhookResponse.slackWebhookUrl || '';
        setSlackWebhookUrl(slackWebhookData);
        
        // 获取WeChat Work Webhook URL
        const wechatworkWebhookResponse = await invoke('getWeChatWorkWebhookUrl');
        const wechatworkWebhookData = wechatworkWebhookResponse.wechatworkWebhookUrl || '';
        setWeChatWorkWebhookUrl(wechatworkWebhookData);
        
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    try {
      // 保存前验证时间格式
      const isValidTime = await validateTimeFormat(scheduleTime);
      if (!isValidTime) {
        setError(t('invalidTimeFormat', {}, language));
        return;
      }
      
      // 获取当前Jira站点的上下文信息
      const forgeContext = await view.getContext();

      
      // 从上下文中提取站点URL
      let jiraSiteUrl = '';
      if (forgeContext && forgeContext.siteUrl) {
        jiraSiteUrl = forgeContext.siteUrl;
        console.log('Extracted Jira site URL from context:', jiraSiteUrl);
      } else {
        // 如果无法从上下文获取，尝试从window.location获取
        jiraSiteUrl = window.location.origin;
        console.log('Extracted Jira site URL from window.location:', jiraSiteUrl);
      }
      
      // 保存Jira站点URL到storage
      if (jiraSiteUrl) {
        const jiraUrlResult = await invoke('saveJiraSiteUrl', { jiraSiteUrl });
        console.log('Jira site URL save result:', jiraUrlResult);
        if (!jiraUrlResult.success) {
          setError(`Failed to save Jira site URL: ${jiraUrlResult.message}`);
          return;
        }
      }
      
      // 将用户输入的本地时间转换为GMT时间进行存储
      const gmtScheduleTime = await convertLocalTimeToGMT(scheduleTime);
      console.log('Time conversion:', { 
        localTime: scheduleTime, 
        gmtTime: gmtScheduleTime,
        timezoneOffset: await invoke('getTimezoneOffset')
      });
      
      // 保存飞书Webhook URL
      const feishuWebhookResult = await invoke('saveFeishuWebhookUrl', {  feishuWebhookUrl });
      console.log('Feishu webhook save result:', feishuWebhookResult);
      if (!feishuWebhookResult.success) {
        setWebhookError(feishuWebhookResult.message);
        return;
      }
      
      // 保存Slack Webhook URL
      const slackWebhookResult = await invoke('saveSlackWebhookUrl', { slackWebhookUrl });
      console.log('Slack webhook save result:', slackWebhookResult);
      if (!slackWebhookResult.success) {
        setWebhookError(slackWebhookResult.message);
        return;
      }
      
      // 保存WeChat Work Webhook URL
      const wechatworkWebhookResult = await invoke('saveWeChatWorkWebhookUrl', { wechatworkWebhookUrl });
      console.log('WeChat Work webhook save result:', wechatworkWebhookResult);
      if (!wechatworkWebhookResult.success) {
        setWebhookError(wechatworkWebhookResult.message);
        return;
      }
      
      const response = await invoke('saveUserSettings', { settings, schedulePeriod, gmtScheduleTime });
      const successMessage = response.success ? 'Settings saved successfully' : 'Failed to save settings';
      setMessage(successMessage);
      
      // 3秒后自动清除消息
      setTimeout(() => {
        setMessage('');
      }, 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTimeChange = (value) => {
    // TimePicker onChange provides the selected time value directly
    console.log('Time changed to:', value);
    // TimePicker returns the time in ISO format or empty string
    setScheduleTime(value);
    // When user modifies time, clear previous error message
    if (error) {
      setError(undefined);
    }
  };



  // Handle Teams Webhook URL change
  // const handleWebhookUrlChange = (value) => {
  //   // Forge React Textfield onChange provides the new value directly
  //   const newUrl = typeof value === 'string' ? value : (value?.target?.value || '');
  //   console.log('Teams webhook URL changed:', newUrl ? '[REDACTED]' : 'empty');
  //   setTeamsWebhookUrl(newUrl);
  //   // Clear webhook error when user starts typing
  //   if (webhookError) {
  //     setWebhookError('');
  //   }
  // };
  
  // Handle Feishu Webhook URL change
  const handleFeishuWebhookUrlChange = (value) => {
    const newUrl = typeof value === 'string' ? value : (value?.target?.value || '');
    console.log('Feishu webhook URL changed:', newUrl);
    setFeishuWebhookUrl(newUrl);
    if (webhookError) {
      setWebhookError('');
    }
    if (error) {
      setError('');
    }
  };
  
  // Handle Slack Webhook URL change
  const handleSlackWebhookUrlChange = (value) => {
    const newUrl = typeof value === 'string' ? value : (value?.target?.value || '');
    console.log('Slack webhook URL changed:', newUrl);
    setSlackWebhookUrl(newUrl);
    if (webhookError) {
      setWebhookError('');
    }
    if (error) {
      setError('');
    }
  };

  // Handle WeChat Work Webhook URL change
  const handleWeChatWorkWebhookUrlChange = (value) => {
    const newUrl = typeof value === 'string' ? value : (value?.target?.value || '');
    console.log('WeChat Work webhook URL changed:', newUrl);
    setWeChatWorkWebhookUrl(newUrl);
    if (webhookError) {
      setWebhookError('');
    }
    if (error) {
      setError('');
    }
  };

  const handlePeriodChange = (option) => {
    console.log('Period changed to:', option);
    setSchedulePeriod(option);
    // 当用户修改周期时，也清除错误消息
    if (error) {
      setError(undefined);
    }
  };




  if (isLoading) {
    return <Text>{t('loadingSettings', {}, language)}</Text>;
  }

  return (
    <>
      <SettingsTable 
        settings={settings}
        setSettings={setSettings}
        language={language}
      />      

      <Box paddingInline="space.200" borderWidth="1px" borderStyle="solid" borderColor="gray">
        <Text size="large" weight="bold">{t('scheduleSettings', {}, language)}</Text>
        <Box padding="small">
          <Label labelFor="schedulePeriod">
            {t('schedulePeriod', {}, language)}
          </Label>
          <Select
            id="schedulePeriod"
            value={schedulePeriod}
            onChange={(option) => handlePeriodChange(option)}
            options={periodOptions}
          />
        </Box>
        <Box padding="small">
          <Label labelFor="scheduleTime">
            {t('scheduleTime', {}, language)}
          </Label>
          <TimePicker
            value={scheduleTime}
            onChange={handleTimeChange}
            placeholder={t('selectTime', {}, language)}
            timeFormat="HH:mm"
            timeIsEditable={true}
            selectProps={{
              inputId: "scheduleTime",
            }}
          />
        </Box>
        
        <Box padding="small">
          <Label labelFor="feishuWebhookUrl">
            {t('feishu', {}, language)} {t('webhookUrl', {}, language)}
          </Label>
          <Textfield
            id="feishuWebhookUrl"
            value={feishuWebhookUrl}
            onChange={handleFeishuWebhookUrlChange}
            placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
          />
          <Text size="small" color="subdued">
            {t('configureWebhook', {platform: t('feishu', {}, language)}, language)} ({t('optional', {}, language)})
          </Text>
        </Box>
        
        <Box padding="small">
          <Label labelFor="slackWebhookUrl">
            {t('slack', {}, language)} {t('webhookUrl', {}, language)}
          </Label>
          <Textfield
            id="slackWebhookUrl"
            value={slackWebhookUrl}
            onChange={handleSlackWebhookUrlChange}
            placeholder="https://hooks.slack.com/services/..."
          />
          <Text size="small" color="subdued">
            {t('configureWebhook', {platform: t('slack', {}, language)}, language)} ({t('optional', {}, language)})
          </Text>
        </Box>
        
        <Box padding="small">
          <Label labelFor="wechatworkWebhookUrl">
            {t('wechatwork', {}, language)} {t('webhookUrl', {}, language)}
          </Label>
          <Textfield
            id="wechatworkWebhookUrl"
            value={wechatworkWebhookUrl}
            onChange={handleWeChatWorkWebhookUrlChange}
            placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
          />
          <Text size="small" color="subdued">
            {t('configureWebhook', {platform: t('wechatwork', {}, language)}, language)} ({t('optional', {}, language)})
          </Text>
        </Box>
        
        <Box padding="small">
          <Text size="small" color="subdued">
            {t('notificationExplanation', {}, language)}
          </Text>
        </Box>
        
        {webhookError && <ErrorMessage>{webhookError}</ErrorMessage>}
        {error && <ErrorMessage>{error}</ErrorMessage>}
      </Box>

      <Box padding="space.200">
          <Button appearance="primary" onClick={handleSaveSettings}>{t('save', {}, language)} {t('settings', {}, language)}</Button>
          <Text>{message}</Text>
      </Box>
    </>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);