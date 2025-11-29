import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Box, Text, Textfield, Button, Select, Label, ErrorMessage, TimePicker } from '@forge/react';
import { invoke, view } from '@forge/bridge';
import SettingsTable from '../components/SettingsTable';

// 获取用户时区偏移量（分钟）
const getTimezoneOffset = () => {
  return new Date().getTimezoneOffset();
};

// 将本地时间转换为GMT时间
const convertLocalTimeToGMT = (localTime) => {
  if (!localTime || typeof localTime !== 'string') return '17:00';
  
  const timeRegex = /^(\d{1,2}):(\d{1,2})$/;
  const match = localTime.trim().match(timeRegex);
  
  if (!match) return localTime;
  
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  
  // 获取时区偏移量（分钟）
  const timezoneOffset = getTimezoneOffset();
  
  // 计算GMT时间（本地时间 + 时区偏移）
  let gmtHours = hours + Math.floor(timezoneOffset / 60);
  let gmtMinutes = minutes + (timezoneOffset % 60);
  
  // 处理分钟进位
  if (gmtMinutes >= 60) {
    gmtHours += Math.floor(gmtMinutes / 60);
    gmtMinutes = gmtMinutes % 60;
  } else if (gmtMinutes < 0) {
    gmtHours -= Math.ceil(Math.abs(gmtMinutes) / 60);
    gmtMinutes = 60 + (gmtMinutes % 60);
  }
  
  // 处理小时进位和边界
  if (gmtHours >= 24) {
    gmtHours = gmtHours % 24;
  } else if (gmtHours < 0) {
    gmtHours = 24 + (gmtHours % 24);
  }
  
  // 格式化时间为HH:MM
  const formattedHours = gmtHours.toString().padStart(2, '0');
  const formattedMinutes = gmtMinutes.toString().padStart(2, '0');
  
  return `${formattedHours}:${formattedMinutes}`;
};

// 将GMT时间转换为本地时间
const convertGMTToLocalTime = (gmtTime) => {
  if (!gmtTime || typeof gmtTime !== 'string') return '17:00';
  
  const timeRegex = /^(\d{1,2}):(\d{1,2})$/;
  const match = gmtTime.trim().match(timeRegex);
  
  if (!match) return gmtTime;
  
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  
  // 获取时区偏移量（分钟）
  const timezoneOffset = getTimezoneOffset();
  
  // 计算本地时间（GMT时间 - 时区偏移）
  let localHours = hours - Math.floor(timezoneOffset / 60);
  let localMinutes = minutes - (timezoneOffset % 60);
  
  // 处理分钟进位
  if (localMinutes >= 60) {
    localHours += Math.floor(localMinutes / 60);
    localMinutes = localMinutes % 60;
  } else if (localMinutes < 0) {
    localHours -= Math.ceil(Math.abs(localMinutes) / 60);
    localMinutes = 60 + (localMinutes % 60);
  }
  
  // 处理小时进位和边界
  if (localHours >= 24) {
    localHours = localHours % 24;
  } else if (localHours < 0) {
    localHours = 24 + (localHours % 24);
  }
  
  // 格式化时间为HH:MM
  const formattedHours = localHours.toString().padStart(2, '0');
  const formattedMinutes = localMinutes.toString().padStart(2, '0');
  
  return `${formattedHours}:${formattedMinutes}`;
};

const App = () => {
  const [settings, setSettings] = useState([{ jql: '' }]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(undefined);
  const [schedulePeriod, setSchedulePeriod] = useState({ label: 'Daily', value: 'Daily' });
  const [scheduleTime, setScheduleTime] = useState('17:00');
  //const [teamsWebhookUrl, setTeamsWebhookUrl] = useState('');
  const [feishuWebhookUrl, setFeishuWebhookUrl] = useState('');
  const [webhookError, setWebhookError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const [
          { settings: settingsData },
          { schedulePeriod: periodData },
          { scheduleTime: timeData },
          //{ url: teamsWebhookData },
          { url: feishuWebhookData }
        ] = await Promise.all([
          invoke('getSettings'),
          invoke('getschedulePeriod'),
          invoke('getscheduleTime'),
          //invoke('getTeamsWebhookUrl'),
          invoke('getFeishuWebhookUrl')
        ]);
        
        setSettings(settingsData.length > 0 ? settingsData : [{ jql: '' }]);

        console.log('Setting initial values:', { 
          settingsData,
          periodData, 
          timeData,
          //teamsWebhookData,
          feishuWebhookData
        });

        const normalizedPeriod = normalizePeriod(periodData);
        // 从后端获取的是GMT时间，需要转换为本地时间显示
        const normalizedTime = convertGMTToLocalTime(normalizeTime(timeData));

        console.log('Setting normalized values:', { 
          normalizedPeriod, 
          normalizedTime,
          originalGMTTime: timeData,
          // teamsWebhookUrl: teamsWebhookData,
          feishuWebhookUrl: feishuWebhookData
        });

        setSchedulePeriod(normalizedPeriod);
        setScheduleTime(normalizedTime);
        // setTeamsWebhookUrl(teamsWebhookData || '');
        setFeishuWebhookUrl(feishuWebhookData || '');

      } catch (err) {
        setError(`Failed to load settings: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    try {
      // 保存前验证时间格式
      if (!isValidTimeFormat(scheduleTime)) {
        setError('Please enter a valid time format (HH:MM)');
        return;
      }
      
      // 获取当前Jira站点的上下文信息
      const forgeContext = await view.getContext();
      console.log('Forge context:', forgeContext);
      
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
      const gmtScheduleTime = convertLocalTimeToGMT(scheduleTime);
      console.log('Time conversion:', { 
        localTime: scheduleTime, 
        gmtTime: gmtScheduleTime,
        timezoneOffset: getTimezoneOffset()
      });
      
      // 保存Teams Webhook URL
      // const teamsWebhookResult = await invoke('saveTeamsWebhookUrl', { teamsWebhookUrl });
      // console.log('Teams webhook save result:', teamsWebhookResult);
      // if (!teamsWebhookResult.success) {
      //   setWebhookError(feishuWebhookResult.message);
      //   return;
      // }
      
      // 保存飞书Webhook URL
      const feishuWebhookResult = await invoke('saveFeishuWebhookUrl', {  feishuWebhookUrl });
      console.log('Feishu webhook save result:', feishuWebhookResult);
      if (!feishuWebhookResult.success) {
        setWebhookError(feishuWebhookResult.message);
        return;
      }
      //scheduleTime  = gmtScheduleTime;
      const response = await invoke('saveUserSettings', { settings, schedulePeriod, gmtScheduleTime });
      //scheduleTime = convertGMTToLocalTime(scheduleTime);
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

  // 删除旧的handlePeriodChange函数，使用新的版本

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
    // Forge React Textfield onChange provides the new value directly
    const newUrl = typeof value === 'string' ? value : (value?.target?.value || '');
    console.log('Feishu webhook URL changed:', newUrl ? newUrl : 'empty');
    setFeishuWebhookUrl(newUrl);
    // Clear webhook error when user starts typing
    if (webhookError) {
      setWebhookError('');
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
    return <Text>Loading settings...</Text>;
  }

  return (
    <>
      <SettingsTable 
        settings={settings}
        setSettings={setSettings}
      />      

      <Box paddingInline="space.200" borderWidth="1px" borderStyle="solid" borderColor="gray">
        <Text size="large" weight="bold">Schedule Settings</Text>
        <Box padding="small">
          <Label labelFor="schedulePeriod">
            Schedule Period
          </Label>
          <Select
            id="schedulePeriod"
            value={schedulePeriod}
            // @forge/react Select onChange provides the new value directly (not a DOM event)
            onChange={(option) => handlePeriodChange(option)}
            options={periodOptions}
          />
        </Box>
        <Box padding="small">
          <Label labelFor="scheduleTime">
            Schedule Time
          </Label>
          <TimePicker
            value={scheduleTime}
            onChange={handleTimeChange}
            placeholder="Select time"
            timeFormat="HH:mm"
            timeIsEditable={true}
            selectProps={{
              inputId: "scheduleTime",
            }}
          />
        </Box>
        {/* <Box padding="small">
          <Label labelFor="teamsWebhookUrl">
            Teams Webhook URL
          </Label>
          <Textfield
            id="teamsWebhookUrl"
            value={teamsWebhookUrl}
            onChange={handleWebhookUrlChange}
            placeholder="https://your-tenant.webhook.office.com/webhookb2/..."
          />
          <Text size="small" color="subdued">
            Configure your Microsoft Teams webhook URL for notifications (optional)
          </Text>
        </Box> */}
        
        <Box padding="small">
          <Label labelFor="feishuWebhookUrl">
            Feishu Webhook URL
          </Label>
          <Textfield
            id="feishuWebhookUrl"
            value={feishuWebhookUrl}
            onChange={handleFeishuWebhookUrlChange}
            placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
          />
          <Text size="small" color="subdued">
            Configure your Feishu webhook URL for notifications (optional)
          </Text>
        </Box>
        
        <Box padding="small">
          <Text size="small" color="subdued">
            Notifications will be sent to all configured webhook URLs. Leave blank to disable notifications for a specific platform.
          </Text>
        </Box>
        
        {webhookError && <ErrorMessage>{webhookError}</ErrorMessage>}
        {error && <ErrorMessage>{error}</ErrorMessage>}
      </Box>

      <Box padding="space.200">
          <Button appearance="primary" onClick={handleSaveSettings}>Save Settings</Button>
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