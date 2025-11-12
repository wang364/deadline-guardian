import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Box, Text, Textfield, Button, Select, Label, RequiredAsterisk, ErrorMessage } from '@forge/react';
import { invoke } from '@forge/bridge';
import SettingsTable from '../components/SettingsTable';

const App = () => {
  const [settings, setSettings] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(undefined);
  const [schedulePeriod, setSchedulePeriod] = useState({ label: 'Daily', value: 'Daily' });
  const [scheduleTime, setScheduleTime] = useState('17:00');
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

  const normalizeTime = (val) => {
    if (!val || typeof val !== 'string') return '17:00';
    const v = val.trim();
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    console.log('Normalizing time:', v, timeRegex.test(v));
    return timeRegex.test(v) ? v : '17:00';
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const [
          { settings: settingsData },
          { schedulePeriod: periodData },
          { scheduleTime: timeData }
        ] = await Promise.all([
          invoke('getSettings'),
          invoke('getschedulePeriod'),
          invoke('getscheduleTime')
        ]);
        
        setSettings(settingsData || []);

        const normalizedPeriod = normalizePeriod(periodData);
        const normalizedTime = normalizeTime(timeData);

        console.log('Setting initial values:', { 
          periodData, 
          normalizedPeriod, 
          timeData, 
          normalizedTime 
        });

        setSchedulePeriod(normalizedPeriod);
        setScheduleTime(normalizedTime);

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
      const response = await invoke('saveUserSettings', { settings, schedulePeriod, scheduleTime });
      setMessage(response.success ? 'Settings saved successfully' : 'Failed to save settings');
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePeriodChange = (option) => {
    console.log('Period changed to:', option);
    setSchedulePeriod(option);
  };

  const handleTimeChange = (e) => {
    console.log('Time changed to:', e.target.value);
    const t = normalizeTime(e.target.value);
    console.log('Normalized time to:', t);
    setScheduleTime(t);
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