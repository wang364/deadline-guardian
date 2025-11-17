import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Box, Text, Textfield, Button, Select, Label, ErrorMessage } from '@forge/react';
import { invoke } from '@forge/bridge';
import SettingsTable from '../components/SettingsTable';

const App = () => {
  const [settings, setSettings] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(undefined);
  const [schedulePeriod, setSchedulePeriod] = useState({ label: 'Daily', value: 'Daily' });
  const [scheduleTime, setScheduleTime] = useState('17:00');
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState('');
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
          { url: teamsWebhookData },
          { url: feishuWebhookData }
        ] = await Promise.all([
          invoke('getSettings'),
          invoke('getschedulePeriod'),
          invoke('getscheduleTime'),
          invoke('getTeamsWebhookUrl'),
          invoke('getFeishuWebhookUrl')
        ]);
        
        setSettings(settingsData || []);

        console.log('Setting initial values:', { 
          periodData, 
          timeData,
          teamsWebhookData,
          feishuWebhookData
        });

        const normalizedPeriod = normalizePeriod(periodData);
        const normalizedTime = normalizeTime(timeData);

        console.log('Setting normalized values:', { 
          normalizedPeriod, 
          normalizedTime,
          teamsWebhookUrl: teamsWebhookData,
          feishuWebhookUrl: feishuWebhookData
        });

        setSchedulePeriod(normalizedPeriod);
        setScheduleTime(normalizedTime);
        setTeamsWebhookUrl(teamsWebhookData || '');
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
      
      // 保存Teams Webhook URL
      const teamsWebhookResult = await invoke('saveTeamsWebhookUrl', { teamsWebhookUrl });
      console.log('Teams webhook save result:', teamsWebhookResult);
      if (!teamsWebhookResult.success) {
        setWebhookError(teamsWebhookResult.message);
        return;
      }
      
      // 保存飞书Webhook URL
      const feishuWebhookResult = await invoke('saveFeishuWebhookUrl', {  feishuWebhookUrl });
      console.log('Feishu webhook save result:', feishuWebhookResult);
      if (!feishuWebhookResult.success) {
        setWebhookError(feishuWebhookResult.message);
        return;
      }
      
      const response = await invoke('saveUserSettings', { settings, schedulePeriod, scheduleTime });
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
    // @forge/react Textfield onChange提供的是新值直接作为参数
    console.log('Time changed to:', value);
    // 直接设置用户输入的值，不做任何处理
    setScheduleTime(value.target.value);
    // 当用户修改时间时，清除之前的错误消息
    if (error) {
      setError(undefined);
    }
  };



  // Handle Teams Webhook URL change
  const handleWebhookUrlChange = (value) => {
    // Forge React Textfield onChange provides the new value directly
    const newUrl = typeof value === 'string' ? value : (value?.target?.value || '');
    console.log('Teams webhook URL changed:', newUrl ? '[REDACTED]' : 'empty');
    setTeamsWebhookUrl(newUrl);
    // Clear webhook error when user starts typing
    if (webhookError) {
      setWebhookError('');
    }
  };
  
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
      {error && <ErrorMessage>{error}</ErrorMessage>}
      

      <Box padding="space.200" borderWidth="1px" borderStyle="solid" borderColor="gray">
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
          <Text size="small" color="subdued">
            Current value: {schedulePeriod ? `${schedulePeriod.label} (${schedulePeriod.value})` : 'None'}
          </Text>
        </Box>
        <Box padding="small">
          <Label labelFor="scheduleTime">
            Schedule Time (HH:MM)
          </Label>
          <Textfield
            id="scheduleTime"
            value={scheduleTime}
            // @forge/react Textfield onChange provides the new value directly
            onChange={(e) => handleTimeChange(e)}
          />
        </Box>
        <Box padding="small">
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
        </Box>
        
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